"""
29_scouting_tags.py — Auto-assign scouting tags based on player data.

Derives tags from: level/peak/overall trajectory, attribute grades,
preferred foot, height, position, career metrics, xG data.

Usage:
    python 29_scouting_tags.py                  # assign tags
    python 29_scouting_tags.py --dry-run        # preview only
    python 29_scouting_tags.py --clear-defaults # remove generic default tags first
"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict

from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Auto-assign scouting tags")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--clear-defaults", action="store_true", help="Remove generic default tags (Fully Fit, Sharp, etc.)")
args = parser.parse_args()

DRY_RUN = args.dry_run


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

    # ── Clear useless default tags ─────────────────────────────────────────
    if args.clear_defaults:
        default_tags = ["Fully Fit", "Sharp", "Adaptable", "One Year Left", "Clear"]
        default_ids = [tag_map[t] for t in default_tags if t in tag_map]
        if default_ids:
            cur.execute("DELETE FROM player_tags WHERE tag_id = ANY(%s)", (default_ids,))
            print(f"  Cleared {cur.rowcount:,} default tag assignments")

    # ── Load player data ───────────────────────────────────────────────────
    cur.execute("""
        SELECT
            pp.person_id, pe.name, pp.position, pp.secondary_position,
            pp.level, pp.peak, pp.overall, pp.archetype,
            pe.preferred_foot, pe.height_cm
        FROM player_profiles pp
        JOIN people pe ON pe.id = pp.person_id
        WHERE pp.level IS NOT NULL
    """)
    players = cur.fetchall()
    print(f"  {len(players):,} players with level data")

    # ── Load career trajectories ───────────────────────────────────────────
    cur.execute("SELECT person_id, trajectory, clubs_count, loan_count FROM career_metrics")
    trajectories = {row["person_id"]: row for row in cur.fetchall()}

    # ── Load attribute grades (best per attribute per player) ──────────────
    cur.execute("""
        SELECT player_id, attribute,
               COALESCE(scout_grade, stat_score, 0) as score,
               source
        FROM attribute_grades
        WHERE source != 'eafc_inferred'
    """)
    player_attrs: dict[int, dict[str, float]] = defaultdict(dict)
    for row in cur.fetchall():
        pid = row["player_id"]
        attr = row["attribute"]
        score = float(row["score"])
        # Keep highest score per attribute
        if attr not in player_attrs[pid] or score > player_attrs[pid][attr]:
            player_attrs[pid][attr] = score

    # ── Load understat xG data for over/underperformance ───────────────────
    cur.execute("""
        SELECT player_id,
               SUM(CASE WHEN attribute = 'goals_p90' THEN COALESCE(stat_score, 0) END) as goals_score,
               SUM(CASE WHEN attribute = 'xg_p90' THEN COALESCE(stat_score, 0) END) as xg_score,
               SUM(CASE WHEN attribute = 'npxg_p90' THEN COALESCE(stat_score, 0) END) as npxg_score
        FROM attribute_grades
        WHERE source = 'understat'
          AND attribute IN ('goals_p90', 'xg_p90', 'npxg_p90')
        GROUP BY player_id
    """)
    xg_data = {row["player_id"]: row for row in cur.fetchall()}

    # ── Load existing scouting tag assignments ─────────────────────────────
    cur.execute("""
        SELECT pt.player_id, t.tag_name
        FROM player_tags pt
        JOIN tags t ON t.id = pt.tag_id
        WHERE t.category = 'scouting'
    """)
    existing_scouting = defaultdict(set)
    for row in cur.fetchall():
        existing_scouting[row["player_id"]].add(row["tag_name"])

    # ── Derive tags ────────────────────────────────────────────────────────
    assignments: list[tuple[int, int]] = []  # (player_id, tag_id)
    tag_counts: dict[str, int] = defaultdict(int)

    for p in players:
        pid = p["person_id"]
        level = p["level"] or 0
        peak = p["peak"] or 0
        overall = p["overall"] or 0
        position = p["position"] or ""
        secondary = p["secondary_position"]
        foot = (p["preferred_foot"] or "").lower()
        height = p["height_cm"] or 0
        archetype = p["archetype"] or ""
        traj = trajectories.get(pid, {})
        attrs = player_attrs.get(pid, {})
        xg = xg_data.get(pid, {})
        existing = existing_scouting.get(pid, set())

        tags_for_player: list[str] = []

        # ── Trajectory-based tags ──────────────────────────────────────
        gap = peak - level
        trajectory = traj.get("trajectory", "")

        # High Ceiling: peak significantly above current level
        if gap >= 8 and level < 85:
            tags_for_player.append("High Ceiling")

        # Low Floor: peak close to level, already plateaued, not elite
        if gap <= 2 and level >= 78 and level < 85 and trajectory in ("peak", "declining"):
            tags_for_player.append("Low Floor")

        # Late Bloomer: rising trajectory, level > 78, peak still ahead
        if trajectory == "rising" and level >= 78 and gap >= 4:
            tags_for_player.append("Late Bloomer")

        # Declining: declining trajectory
        if trajectory == "declining" and level >= 75:
            tags_for_player.append("Declining")

        # ── Versatility ────────────────────────────────────────────────
        if secondary and secondary != position:
            tags_for_player.append("Versatile")

        # ── Foot preference ────────────────────────────────────────────
        # Inverted: left-footed on right side, or right-footed on left
        # (crude: left-footed wide players are often inverted)
        if foot == "left" and position in ("WF", "WM") and level >= 78:
            tags_for_player.append("Inverted")

        # ── Physical tags ──────────────────────────────────────────────
        # Aerial Threat: tall + heading/aerial attributes
        aerial = attrs.get("aerial_duels", 0) + attrs.get("heading", 0)
        if height >= 188 and (aerial >= 10 or position in ("CF", "CD")):
            tags_for_player.append("Aerial Threat")

        # Pace Merchant: sprinter archetype or high pace attributes
        pace_score = attrs.get("pace", 0) + attrs.get("acceleration", 0)
        if "Sprinter" in archetype and pace_score >= 10:
            tags_for_player.append("Pace Merchant")

        # ── Attribute-based tags ───────────────────────────────────────
        # Press Resistant: composure + decisions high
        composure = attrs.get("composure", 0) + attrs.get("decisions", 0)
        if composure >= 14:
            tags_for_player.append("Press Resistant")

        # Ball Progressor: carries + progressive passing
        prog = attrs.get("carries", 0) + attrs.get("pass_range", 0)
        if prog >= 14:
            tags_for_player.append("Ball Progressor")

        # Leadership Material: leadership + communication high
        lead = attrs.get("leadership", 0) + attrs.get("communication", 0)
        if lead >= 14:
            tags_for_player.append("Leadership Material")

        # Deep Lying: DM/CM with high passing + vision
        if position in ("DM", "CM"):
            deep = attrs.get("vision", 0) + attrs.get("pass_accuracy", 0)
            if deep >= 14 and "Controller" in archetype:
                tags_for_player.append("Deep Lying")

        # ── xG-based tags ─────────────────────────────────────────────
        if xg:
            goals_s = float(xg.get("goals_score") or 0)
            xg_s = float(xg.get("xg_score") or 0)
            if goals_s > 0 and xg_s > 0:
                if goals_s >= xg_s + 3:
                    tags_for_player.append("Overperforming xG")
                elif xg_s >= goals_s + 3:
                    tags_for_player.append("Underperforming xG")

        # ── Market/career tags ─────────────────────────────────────────
        clubs = traj.get("clubs_count", 0)
        loans = traj.get("loan_count", 0)

        # Loan Candidate: young, low level relative to peak, has loan history
        if level < 75 and gap >= 5 and (loans or 0) >= 1:
            tags_for_player.append("Loan Candidate")

        # Hidden Gem: high peak but low current level, not well-known
        if peak >= 85 and level < 78:
            tags_for_player.append("Hidden Gem")

        # Sell High: at or near peak, declining trajectory
        if level >= 82 and gap <= 2 and trajectory in ("peak", "declining"):
            tags_for_player.append("Sell High")

        # Buy Low: good peak but current level depressed
        if peak >= 83 and level < peak - 5 and trajectory not in ("declining",):
            tags_for_player.append("Buy Low")

        # ── Big Game Player: high level + leadership + composure ───────
        if level >= 85 and (attrs.get("composure", 0) >= 7 or attrs.get("leadership", 0) >= 7):
            tags_for_player.append("Big Game Player")

        # ── Assign tags (skip already assigned) ────────────────────────
        for tag_name in tags_for_player:
            if tag_name in existing:
                continue
            tid = tag_id(tag_name)
            if tid:
                assignments.append((pid, tid))
                tag_counts[tag_name] += 1

    # ── Summary ────────────────────────────────────────────────────────────
    print(f"\n  Tag assignments to make: {len(assignments):,}")
    print(f"  Players affected: {len(set(a[0] for a in assignments)):,}")
    print()
    for tag_name, count in sorted(tag_counts.items(), key=lambda x: -x[1]):
        print(f"    {tag_name:25} {count:>5}")

    if DRY_RUN:
        # Show sample
        sample_players = {}
        for pid, tid in assignments[:200]:
            name = next((p["name"] for p in players if p["person_id"] == pid), "?")
            tag_name = next((k for k, v in tag_map.items() if v == tid), "?")
            sample_players.setdefault(name, []).append(tag_name)

        print(f"\n  Sample assignments:")
        for name, tags in list(sample_players.items())[:15]:
            print(f"    {name:30} {', '.join(tags)}")

        print("\n--dry-run: no writes.")
        conn.rollback()
        conn.close()
        return

    # ── Write ──────────────────────────────────────────────────────────────
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
        print("\n  No new assignments to write")

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
