"""
90_scouting_notes.py — Multi-perspective scouting note generation.

Uses llm_router (quality preference) to generate 3-5 sentence scouting notes
that weave scout, historian, and DoF perspectives.

Usage:
    python 90_scouting_notes.py --dry-run           # preview without writing
    python 90_scouting_notes.py --top 100            # top 100 by role score
    python 90_scouting_notes.py --player "Vitinha"   # single player
    python 90_scouting_notes.py --force              # overwrite existing notes
    python 90_scouting_notes.py --flagged-only       # re-generate flagged notes
"""
from __future__ import annotations

import argparse
import time
from collections import defaultdict
from datetime import date

import psycopg2
import psycopg2.extras

from config import POSTGRES_DSN
from lib.llm_router import LLMRouter

# ── CLI ────────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Multi-perspective scouting notes")
parser.add_argument("--top", type=int, default=500, help="Top N players by role score")
parser.add_argument("--force", action="store_true", help="Overwrite existing notes")
parser.add_argument("--dry-run", action="store_true", help="Preview without DB writes")
parser.add_argument("--player", default=None, help="Single player by name")
parser.add_argument("--flagged-only", action="store_true", help="Only re-generate flagged notes")
args = parser.parse_args()

BATCH_SIZE = 10
INTER_BATCH_DELAY = 2  # seconds

# ── Pillar tier mapping ────────────────────────────────────────────────────────
def pillar_tier(score: float | None) -> str | None:
    if score is None:
        return None
    if score >= 70:
        return "strong"
    if score >= 55:
        return "moderate"
    return "limited"

# ── Personality descriptors ────────────────────────────────────────────────────
def personality_descriptors(ei, sn, tf, jp) -> list[str]:
    if any(v is None for v in [ei, sn, tf, jp]):
        return []
    return [
        "extraverted" if ei >= 50 else "introverted",
        "practical" if sn >= 50 else "intuitive",
        "competitive" if tf >= 50 else "empathetic",
        "structured" if jp >= 50 else "spontaneous",
    ]

# ── Fetch top-N players ───────────────────────────────────────────────────────
def fetch_players(cur, args) -> list[dict]:
    """Fetch player dossiers ordered by best_role_score."""
    if args.flagged_only:
        where = "AND ps.notes_flagged = true"
        limit = ""
    elif args.player:
        where = "AND p.name ILIKE %s"
        limit = ""
    else:
        where = ""
        if not args.force:
            where = "AND (ps.scouting_notes IS NULL OR LENGTH(ps.scouting_notes) <= 20)"
        limit = f"LIMIT {args.top}"

    query = f"""
        SELECT p.id, p.name,
               EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
               pp.position, c.clubname AS club, n.name AS nation,
               pp.earned_archetype, pp.archetype, pp.blueprint,
               pp.best_role, pp.best_role_score,
               pp.technical_score, pp.tactical_score,
               pp.mental_score, pp.physical_score,
               ppers.ei, ppers.sn, ppers.tf, ppers.jp,
               pm.market_value_tier, pm.transfer_fee_eur,
               ps.scouting_notes, ps.notes_flagged,
               p.height_cm, p.preferred_foot, pp.side
        FROM people p
        JOIN player_profiles pp ON pp.person_id = p.id
        LEFT JOIN player_personality ppers ON ppers.person_id = p.id
        LEFT JOIN player_market pm ON pm.person_id = p.id
        LEFT JOIN player_status ps ON ps.person_id = p.id
        LEFT JOIN clubs c ON c.id = p.club_id
        LEFT JOIN nations n ON n.id = p.nation_id
        WHERE pp.best_role_score IS NOT NULL
          AND p.active = true
          {where}
        ORDER BY pp.best_role_score DESC NULLS LAST
        {limit}
    """
    params = []
    if args.player:
        params.append(f"%{args.player}%")

    cur.execute(query, params)
    return cur.fetchall()

# ── Fetch grades for players ──────────────────────────────────────────────────
def fetch_grades(cur, player_ids: list[int]) -> dict[int, list[tuple]]:
    """Fetch best grades per player. Returns {pid: [(attr, score), ...]} sorted desc."""
    if not player_ids:
        return {}
    cur.execute("""
        SELECT ag.player_id, ag.attribute,
               COALESCE(ag.scout_grade, ag.stat_score) AS score
        FROM attribute_grades ag
        WHERE ag.player_id = ANY(%s)
          AND COALESCE(ag.scout_grade, ag.stat_score) IS NOT NULL
        ORDER BY ag.player_id, COALESCE(ag.scout_grade, ag.stat_score) DESC
    """, (player_ids,))

    grades: dict[int, list[tuple]] = defaultdict(list)
    seen: dict[int, set] = defaultdict(set)
    for row in cur.fetchall():
        pid = row["player_id"]
        attr = row["attribute"]
        if attr not in seen[pid]:
            seen[pid].add(attr)
            grades[pid].append((attr, round(row["score"])))
    return dict(grades)

# ── Fetch traits ──────────────────────────────────────────────────────────────
def fetch_traits(cur, player_ids: list[int]) -> dict[int, list[str]]:
    """Fetch playing style traits per player."""
    if not player_ids:
        return {}
    cur.execute("""
        SELECT player_id, trait
        FROM player_trait_scores
        WHERE player_id = ANY(%s)
        ORDER BY player_id, severity DESC
    """, (player_ids,))

    traits: dict[int, list[str]] = defaultdict(list)
    for row in cur.fetchall():
        traits[row["player_id"]].append(row["trait"])
    return dict(traits)

# ── Fetch career trajectory ───────────────────────────────────────────────────
def fetch_trajectories(cur, player_ids: list[int]) -> dict[int, str]:
    """Fetch career trajectory label per player."""
    if not player_ids:
        return {}
    cur.execute("""
        SELECT player_id, trajectory
        FROM career_metrics
        WHERE player_id = ANY(%s)
    """, (player_ids,))
    return {row["player_id"]: row["trajectory"] for row in cur.fetchall()}

# ── Build dossier text ────────────────────────────────────────────────────────
def build_dossier(player: dict, grades: list[tuple], traits: list[str],
                  trajectory: str | None) -> str | None:
    """Build the text dossier for one player. Returns None if insufficient data."""
    lines = []

    # Identity (always present)
    name = player["name"]
    age = player["age"] or "?"
    pos = player["position"] or "?"
    club = player["club"] or "Unknown"
    nation = player["nation"] or "?"
    lines.append(f"Player: {name} ({age}, {pos}, {club}, {nation})")

    populated = 0  # count of non-identity lines

    # Archetype / Blueprint / Best Role
    archetype = player["earned_archetype"] or player["archetype"]
    blueprint = player["blueprint"]
    best_role = player["best_role"]
    if any([archetype, blueprint, best_role]):
        parts = []
        if archetype:
            parts.append(f"Archetype: {archetype}")
        if blueprint:
            parts.append(f"Blueprint: {blueprint}")
        if best_role:
            parts.append(f"Best Role: {best_role}")
        lines.append(" | ".join(parts))
        populated += 1

    # Pillar balance
    tech = pillar_tier(player["technical_score"])
    tac = pillar_tier(player["tactical_score"])
    men = pillar_tier(player["mental_score"])
    phy = pillar_tier(player["physical_score"])
    if any([tech, tac, men, phy]):
        parts = []
        if tech: parts.append(f"technical={tech}")
        if tac: parts.append(f"tactical={tac}")
        if men: parts.append(f"mental={men}")
        if phy: parts.append(f"physical={phy}")
        lines.append(f"Pillar Balance: {', '.join(parts)}")
        populated += 1

    # Personality
    descs = personality_descriptors(player["ei"], player["sn"], player["tf"], player["jp"])
    if descs:
        lines.append(f"Personality: {', '.join(descs)}")
        populated += 1

    # Grades
    if grades:
        top5 = [g[0] for g in grades[:5]]
        bottom3 = [g[0] for g in grades[-3:]] if len(grades) >= 5 else []
        lines.append(f"Strengths: {', '.join(top5)}")
        if bottom3:
            lines.append(f"Weaknesses: {', '.join(bottom3)}")
        populated += 1

    # Traits
    if traits:
        lines.append(f"Traits: {', '.join(traits[:6])}")
        populated += 1

    # Career / physical
    phys_parts = []
    if trajectory:
        phys_parts.append(f"Career: {trajectory}")
    side = player["side"]
    height = player["height_cm"]
    foot = player["preferred_foot"]
    if side: phys_parts.append(f"Side: {side}")
    if height: phys_parts.append(f"{height}cm")
    if foot: phys_parts.append(f"{foot} foot")
    if phys_parts:
        lines.append(" | ".join(phys_parts))
        populated += 1

    # Skip if insufficient context
    if populated < 3:
        return None

    return "\n".join(lines)

# ── System prompt ─────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a football intelligence analyst writing scouting dossiers. Each note weaves three perspectives:

1. Scout: data-grounded assessment — strengths, weaknesses, archetype fit, pillar balance
2. Historian: tactical lineage — what tradition this player's role belongs to, what systems suit them
3. Director of Football: squad-building value — market position, what kind of club benefits most, risk factors

Rules:
- Write 3-5 sentences per player. Flowing prose, no bullet points, no headers.
- Be opinionated — name weaknesses, don't hedge.
- Use football language (half-spaces, progressive carries, inverted runs, etc).
- Never use clichés like "world-class talent" or "exciting prospect".
- Reference the player's archetype and best role naturally.
- ONLY use information provided in the dossier. Do NOT invent current-season context, match references, historical comparisons, or any facts not present in the input.
- Do not include raw numeric scores in the output. Speak in relative terms.
- Do not reference MBTI types or personality acronyms."""

# ── LLM batch call ────────────────────────────────────────────────────────────
def generate_notes(router: LLMRouter, dossiers: list[tuple[dict, str]]) -> list[dict] | None:
    """Call LLM with a batch of dossiers. Returns [{"name": ..., "notes": ...}] or None."""
    dossier_text = "\n\n---\n\n".join(d[1] for d in dossiers)
    prompt = f"""Write scouting notes for these players. Return JSON: [{{"name": "...", "notes": "..."}}]

---

{dossier_text}"""

    result = router.call(prompt, json_mode=True, system=SYSTEM_PROMPT, preference="quality")
    if not result or not result.parsed:
        return None
    parsed = result.parsed
    if isinstance(parsed, dict) and "players" in parsed:
        parsed = parsed["players"]
    if not isinstance(parsed, list):
        return None
    return parsed

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    conn = psycopg2.connect(POSTGRES_DSN, cursor_factory=psycopg2.extras.RealDictCursor)
    cur = conn.cursor()

    print("── Scouting Notes v2 ──────────────────────────────────")
    print(f"  Mode: {'flagged-only' if args.flagged_only else 'single player' if args.player else f'top {args.top}'}")
    print(f"  Force: {args.force}  Dry run: {args.dry_run}")

    # 1. Fetch players
    players = fetch_players(cur, args)
    print(f"  {len(players)} players in scope")
    if not players:
        print("  Nothing to do.")
        conn.close()
        return

    # 2. Batch-fetch supporting data
    pids = [p["id"] for p in players]
    grades_map = fetch_grades(cur, pids)
    traits_map = fetch_traits(cur, pids)
    trajectory_map = fetch_trajectories(cur, pids)
    print(f"  Grades: {len(grades_map)} | Traits: {len(traits_map)} | Trajectories: {len(trajectory_map)}")

    # 3. Build dossiers
    dossiers: list[tuple[dict, str]] = []
    skipped = 0
    for p in players:
        pid = p["id"]
        text = build_dossier(
            p,
            grades_map.get(pid, []),
            traits_map.get(pid, []),
            trajectory_map.get(pid),
        )
        if text is None:
            skipped += 1
            continue
        dossiers.append((p, text))

    print(f"  Dossiers built: {len(dossiers)} (skipped {skipped} — insufficient data)")

    # 4. Generate notes in batches
    router = LLMRouter(verbose=True)
    total_updated = 0
    total_errors = 0

    for i in range(0, len(dossiers), BATCH_SIZE):
        batch = dossiers[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(dossiers) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"\n  [{batch_num}/{total_batches}] Generating {len(batch)} notes...")

        results = generate_notes(router, batch)
        if not results:
            print(f"    WARN: No results — retrying in 10s")
            time.sleep(10)
            router.reset_disabled()
            results = generate_notes(router, batch)

        if not results:
            print(f"    ERROR: Batch {batch_num} failed, skipping")
            total_errors += len(batch)
            continue

        # Match results to players by name
        result_map = {r.get("name", "").lower().strip(): r for r in results}
        for player, _dossier_text in batch:
            key = player["name"].lower().strip()
            match = result_map.get(key)
            if not match:
                # Try partial match
                for rname, r in result_map.items():
                    if key in rname or rname in key:
                        match = r
                        break

            notes = match.get("notes", "") if match else ""
            if not notes or len(notes) < 20:
                print(f"    SKIP {player['name']}: empty/short note")
                total_errors += 1
                continue

            if args.dry_run:
                print(f"    {player['name']:30} {notes[:80]}...")
                total_updated += 1
                continue

            # Upsert
            cur.execute("""
                INSERT INTO player_status (person_id, scouting_notes, notes_flagged)
                VALUES (%s, %s, false)
                ON CONFLICT (person_id) DO UPDATE
                SET scouting_notes = EXCLUDED.scouting_notes,
                    notes_flagged = false,
                    updated_at = now()
            """, (player["id"], notes))
            total_updated += 1

        if not args.dry_run:
            conn.commit()

        if i + BATCH_SIZE < len(dossiers):
            time.sleep(INTER_BATCH_DELAY)

    # 5. Summary
    router.print_stats()
    print(f"\n  Done: {total_updated} updated, {total_errors} errors")
    conn.close()


if __name__ == "__main__":
    main()
