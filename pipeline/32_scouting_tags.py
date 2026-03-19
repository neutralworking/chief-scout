"""
29_scouting_tags.py — Auto-assign scouting tags based on player data.

PHILOSOPHY: Tags should be rare and meaningful. A tag that applies to 1,000+
players is worthless. Each tag should make a scout say "interesting, tell me more."

Signals used: level, age, trajectory, real attribute grades, position, physicals.
Peak is NOT used (reserved for retired players only).

Rules:
  - Max 3 scouting tags per player (forces signal over noise)
  - Mutual exclusion enforced (no Buy Low + Sell High)
  - Level gates prevent absurdities (Harry Kane is not a Hidden Gem)
  - Attribute tags require real data (scout or stat-derived, not eafc defaults)

Usage:
    python 29_scouting_tags.py                  # assign tags (wipes old scouting tags first)
    python 29_scouting_tags.py --dry-run        # preview only
    python 29_scouting_tags.py --keep-existing  # add to existing tags instead of replacing
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import date

from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Auto-assign scouting tags")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--keep-existing", action="store_true", help="Don't wipe existing scouting tags first")
args = parser.parse_args()

DRY_RUN = args.dry_run

# Tags that cannot coexist on the same player
MUTUALLY_EXCLUSIVE = [
    {"Buy Low", "Sell High"},
    {"Hidden Gem", "Declining"},
    {"High Ceiling", "Low Floor"},
]

MAX_TAGS_PER_PLAYER = 3

# Priority order: higher = assigned first when cap is reached
TAG_PRIORITY = {
    "Press Resistant": 10,
    "Deep Lying": 10,
    "Ball Progressor": 10,
    "Big Game Player": 9,
    "Inverted": 9,
    "Aerial Threat": 8,
    "Pace Merchant": 8,
    "Overperforming xG": 8,
    "Underperforming xG": 8,
    "Late Bloomer": 7,
    "Hidden Gem": 7,
    "Buy Low": 6,
    "Sell High": 6,
    "High Ceiling": 5,
    "Low Floor": 5,
    "Declining": 4,
    "Versatile": 3,
    "Loan Candidate": 2,
}


def enforce_exclusions(tags: list[str]) -> list[str]:
    """Remove lower-priority tag from mutually exclusive pairs."""
    result = set(tags)
    for group in MUTUALLY_EXCLUSIVE:
        present = result & group
        if len(present) > 1:
            keep = max(present, key=lambda t: TAG_PRIORITY.get(t, 0))
            result -= (present - {keep})
    return [t for t in tags if t in result]


def cap_tags(tags: list[str], max_n: int) -> list[str]:
    """Keep only the top N tags by priority."""
    if len(tags) <= max_n:
        return tags
    ranked = sorted(tags, key=lambda t: TAG_PRIORITY.get(t, 0), reverse=True)
    return ranked[:max_n]


def compute_age(dob_str: str | None) -> int | None:
    if not dob_str:
        return None
    try:
        dob = date.fromisoformat(str(dob_str)[:10])
        today = date.today()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    except (ValueError, TypeError):
        return None


def main():
    import psycopg2
    import psycopg2.extras

    print("29 — Scouting Tag Assignment")

    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ── Load tag IDs ───────────────────────────────────────────────────────
    cur.execute("SELECT id, tag_name, category FROM tags")
    tag_map = {row["tag_name"]: row["id"] for row in cur.fetchall()}

    def tag_id(name: str) -> int | None:
        return tag_map.get(name)

    # ── Wipe existing scouting tags (clean slate) ────────────────────────
    if not args.keep_existing:
        scouting_ids = [v for k, v in tag_map.items() if k in TAG_PRIORITY]
        if scouting_ids:
            cur.execute("DELETE FROM player_tags WHERE tag_id = ANY(%s)", (scouting_ids,))
            wiped = cur.rowcount
            print(f"  Wiped {wiped:,} existing scouting tag assignments")

    # ── Load player data ───────────────────────────────────────────────────
    cur.execute("""
        SELECT
            pp.person_id, pe.name, pp.position, pp.secondary_position,
            pp.level, pp.overall, pp.archetype,
            pe.preferred_foot, pe.height_cm, pe.date_of_birth
        FROM player_profiles pp
        JOIN people pe ON pe.id = pp.person_id
        WHERE pp.level IS NOT NULL
    """)
    players = cur.fetchall()
    print(f"  {len(players):,} players with level data")

    # ── Load career trajectories ───────────────────────────────────────────
    cur.execute("SELECT person_id, trajectory, clubs_count, loan_count FROM career_metrics")
    trajectories = {row["person_id"]: row for row in cur.fetchall()}

    # ── Load attribute grades (real data only — no eafc_inferred) ────────
    cur.execute("""
        SELECT player_id, attribute,
               COALESCE(scout_grade, stat_score, 0) as score,
               source
        FROM attribute_grades
        WHERE source NOT IN ('eafc_inferred', 'computed')
    """)
    player_attrs: dict[int, dict[str, float]] = defaultdict(dict)
    has_real_attrs: set[int] = set()
    for row in cur.fetchall():
        pid = row["player_id"]
        attr = row["attribute"]
        score = float(row["score"])
        has_real_attrs.add(pid)
        if attr not in player_attrs[pid] or score > player_attrs[pid][attr]:
            player_attrs[pid][attr] = score

    # ── Load understat xG data ───────────────────────────────────────────
    cur.execute("""
        SELECT player_id,
               SUM(CASE WHEN attribute = 'goals_p90' THEN COALESCE(stat_score, 0) END) as goals_score,
               SUM(CASE WHEN attribute = 'xg_p90' THEN COALESCE(stat_score, 0) END) as xg_score
        FROM attribute_grades
        WHERE source = 'understat'
          AND attribute IN ('goals_p90', 'xg_p90')
        GROUP BY player_id
    """)
    xg_data = {row["player_id"]: row for row in cur.fetchall()}

    # ── Derive tags ────────────────────────────────────────────────────────
    all_assignments: dict[int, list[str]] = {}
    tag_counts: dict[str, int] = defaultdict(int)

    for p in players:
        pid = p["person_id"]
        level = p["level"] or 0
        position = p["position"] or ""
        secondary = p["secondary_position"]
        foot = (p["preferred_foot"] or "").lower()
        height = p["height_cm"] or 0
        archetype = p["archetype"] or ""
        traj = trajectories.get(pid, {})
        attrs = player_attrs.get(pid, {})
        xg = xg_data.get(pid, {})
        age = compute_age(p.get("date_of_birth"))
        has_attrs = pid in has_real_attrs

        candidates: list[str] = []
        trajectory = traj.get("trajectory", "")

        # ── MARKET TAGS ──────────────────────────────────────────────

        # Hidden Gem: low level, unknown quantity, rising or untracked
        # The "scout found someone in the Belgian second division" tag
        if level < 73 and trajectory in ("rising", "newcomer", ""):
            candidates.append("Hidden Gem")

        # Buy Low: decent player clearly below their potential
        # Level 73-80, rising trajectory — someone a smart club picks up cheap
        if 73 <= level <= 80 and trajectory == "rising":
            candidates.append("Buy Low")

        # Sell High: good level but declining — cash in now
        if 82 <= level < 90 and trajectory in ("peak", "declining"):
            candidates.append("Sell High")

        # High Ceiling: young player with room to grow
        # Must have age data — the whole point is youth + trajectory
        if age is not None and age <= 22 and level < 85 and trajectory in ("rising", "newcomer", ""):
            candidates.append("High Ceiling")
        elif age is not None and age <= 20 and level < 80:
            # Very young players get the tag even without trajectory data
            candidates.append("High Ceiling")

        # Low Floor: plateaued, mid-level, what you see is what you get
        if 76 <= level < 83 and trajectory in ("peak", "declining") and age is not None and age >= 28:
            candidates.append("Low Floor")

        # Late Bloomer: rising trajectory at 27+, meaningful level
        if trajectory == "rising" and age is not None and age >= 27 and level >= 78:
            candidates.append("Late Bloomer")

        # Declining: clear downward trajectory, still relevant
        if trajectory == "declining" and level >= 80:
            candidates.append("Declining")

        # Loan Candidate: young, low level, has loan history
        if level < 72 and age is not None and age <= 23 and (traj.get("loan_count") or 0) >= 1:
            candidates.append("Loan Candidate")

        # ── STYLE TAGS (require real attribute data) ─────────────────

        if has_attrs:
            # Press Resistant: composure + decisions both genuinely high
            composure = attrs.get("composure", 0)
            decisions = attrs.get("decisions", 0)
            if composure >= 8 and decisions >= 8:
                candidates.append("Press Resistant")

            # Ball Progressor: carries + progressive passing
            carries = attrs.get("carries", 0)
            pass_range = attrs.get("pass_range", 0)
            if carries >= 8 and pass_range >= 8:
                candidates.append("Ball Progressor")

            # Deep Lying: DM/CM controller with passing/vision
            if position in ("DM", "CM") and "Controller" in archetype:
                vision = attrs.get("vision", 0)
                pass_acc = attrs.get("pass_accuracy", 0)
                if vision >= 7 and pass_acc >= 7:
                    candidates.append("Deep Lying")

        # ── PHYSICAL/STYLE TAGS ──────────────────────────────────────

        # Aerial Threat: genuinely tall + right position
        if height >= 190 and position in ("CF", "CD"):
            candidates.append("Aerial Threat")
        elif height >= 193:
            candidates.append("Aerial Threat")

        # Pace Merchant: sprinter archetype with real pace data
        if has_attrs and "Sprinter" in archetype:
            pace = attrs.get("pace", 0) + attrs.get("acceleration", 0)
            if pace >= 12:
                candidates.append("Pace Merchant")

        # Inverted: left-footed wide player
        if foot == "left" and position in ("WF", "WM") and level >= 78:
            candidates.append("Inverted")

        # Versatile: meaningfully different positions
        NATURAL_PAIRS = {
            frozenset({"WF", "CF"}), frozenset({"CM", "DM"}),
            frozenset({"WD", "CD"}), frozenset({"WM", "AM"}),
            frozenset({"WF", "WM"}),
        }
        if secondary and secondary != position:
            pair = frozenset({position, secondary})
            if pair not in NATURAL_PAIRS:
                candidates.append("Versatile")

        # Big Game Player: elite + real mental data
        if level >= 87 and has_attrs:
            comp = attrs.get("composure", 0)
            lead = attrs.get("leadership", 0)
            if comp >= 8 or lead >= 8:
                candidates.append("Big Game Player")

        # ── xG tags ──────────────────────────────────────────────────
        if xg:
            goals_s = float(xg.get("goals_score") or 0)
            xg_s = float(xg.get("xg_score") or 0)
            if goals_s > 0 and xg_s > 0:
                if goals_s >= xg_s + 4:
                    candidates.append("Overperforming xG")
                elif xg_s >= goals_s + 4:
                    candidates.append("Underperforming xG")

        # ── Enforce rules and cap ────────────────────────────────────
        if not candidates:
            continue

        final = enforce_exclusions(candidates)
        final = cap_tags(final, MAX_TAGS_PER_PLAYER)

        if final:
            all_assignments[pid] = final
            for t in final:
                tag_counts[t] += 1

    # ── Build insert list ─────────────────────────────────────────────────
    assignments: list[tuple[int, int]] = []
    for pid, tags in all_assignments.items():
        for tag_name in tags:
            tid = tag_id(tag_name)
            if tid:
                assignments.append((pid, tid))

    # ── Summary ───────────────────────────────────────────────────────────
    print(f"\n  Players tagged: {len(all_assignments):,}")
    print(f"  Total tag assignments: {len(assignments):,}")
    print()
    for tag_name, count in sorted(tag_counts.items(), key=lambda x: -x[1]):
        print(f"    {tag_name:25} {count:>5}")

    if DRY_RUN:
        name_lookup = {p["person_id"]: p["name"] for p in players}
        level_lookup = {p["person_id"]: p["level"] for p in players}
        print(f"\n  Sample assignments:")
        shown = 0
        for pid, tags in sorted(all_assignments.items(), key=lambda x: -(level_lookup.get(x[0], 0) or 0)):
            name = name_lookup.get(pid, "?")
            lvl = level_lookup.get(pid, 0)
            print(f"    {name:30} L={lvl:>2}  {', '.join(tags)}")
            shown += 1
            if shown >= 30:
                break

        print("\n--dry-run: no writes.")
        conn.rollback()
        conn.close()
        return

    # ── Write ─────────────────────────────────────────────────────────────
    if assignments:
        from psycopg2.extras import execute_values
        BATCH = 2000
        written = 0
        for i in range(0, len(assignments), BATCH):
            batch = assignments[i:i + BATCH]
            execute_values(cur, """
                INSERT INTO player_tags (player_id, tag_id)
                VALUES %s
                ON CONFLICT DO NOTHING
            """, batch)
            written += cur.rowcount

        conn.commit()
        print(f"\n  Written {written:,} tag assignments")
    else:
        print("\n  No assignments to write")

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
