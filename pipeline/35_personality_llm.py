"""
35_personality_llm.py — LLM-powered personality reassessment for profiled players.

Uses Gemini/Groq via LLM router to assess personality dimensions based on:
  - Scouting notes (most valuable signal)
  - Style tags (behavioral indicators)
  - Career trajectory and loyalty patterns
  - Top attribute grades (pressing → analytical, creativity → instinctive, etc.)
  - Position and archetype context

Targets Tier 1/2 players with existing personality data that was inferred.
Writes to player_personality with is_inferred=true, confidence="Medium".

Usage:
    python 35_personality_llm.py --dry-run              # preview without writing
    python 35_personality_llm.py --player "Haaland"     # single player
    python 35_personality_llm.py --limit 50             # max players
    python 35_personality_llm.py --tier 1               # only Tier 1 profiles
    python 35_personality_llm.py --min-level 85         # minimum level threshold
    python 35_personality_llm.py --force                # overwrite manual assessments too
"""
from __future__ import annotations

import argparse
import time
from collections import Counter

from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="LLM personality reassessment")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--player", default=None, help="Filter by player name")
parser.add_argument("--limit", type=int, default=50, help="Max players to process")
parser.add_argument("--tier", type=int, default=None, help="Profile tier filter (1 or 2)")
parser.add_argument("--min-level", type=int, default=80, help="Minimum level threshold")
parser.add_argument("--force", action="store_true", help="Overwrite manual assessments")
parser.add_argument("--batch-size", type=int, default=10, help="Players per LLM call")
args = parser.parse_args()

DRY_RUN = args.dry_run
BATCH_SIZE = args.batch_size

PERSONALITY_PROMPT = """You are a football psychology expert assessing player personalities for a scouting database.

You must score each player on 4 dimensions (0-100 scale, threshold at 50):

1. **Game Reading (ei)**: Analytical (≥50) vs Instinctive (<50)
   - Analytical: reads patterns, positional discipline, methodical decisions, tactical awareness
   - Instinctive: improvises, reacts on instinct, creative unpredictability, plays by feel
   - Key signals: pressing intelligence = A, creative flair = I, positional discipline = A, dribbling past players = I

2. **Motivation (sn)**: Extrinsic (≥50) vs Intrinsic (<50)
   - Extrinsic: feeds off atmosphere, rises for big occasions, showmanship, crowd-driven
   - Intrinsic: self-motivated, consistent output, internal standards, quiet professionalism
   - Key signals: one-club loyalty = N, consistent stats = N, big-game only performer = X, flashy play = X

3. **Social Orientation (tf)**: Soloist (≥50) vs Leader (<50)
   - Soloist: self-contained, task-focused, does their own job, quiet on pitch
   - Leader: organizes teammates, vocal, demands standards, marshals the defence
   - Key signals: captain material = L, silent assassin = S, commands backline = L, lone striker = S

4. **Pressure Response (jp)**: Competitor (≥50) vs Composer (<50)
   - Competitor: confrontational, aggressive, thrives on duels, cards, fire
   - Composer: calm under pressure, ice-cold, composed on the ball, never flustered
   - Key signals: aggressive tackler = C, penalty taker composure = P, hot-headed = C, elegant passer = P

Also score:
- **competitiveness** (1-10): raw desire to win duels and matches
- **coachability** (1-10): receptiveness to instruction and tactical adaptation

IMPORTANT CALIBRATION:
- Scores should DIFFERENTIATE. Don't cluster around 50. Use the full range 15-85.
- A clear Analytical player should be 65-80, not 52.
- A clear Instinctive player should be 20-35, not 48.
- Only use 45-55 when genuinely borderline.
- Think about what makes this player DISTINCTIVE, not average.

Players to assess:
{player_list}

Respond as a JSON array, one object per player:
[
  {{
    "name": "Player Name",
    "ei": 65, "sn": 30, "tf": 55, "jp": 70,
    "competitiveness": 8, "coachability": 7,
    "reasoning": "Brief explanation of key personality signals"
  }},
  ...
]

JSON only, no markdown fences, no commentary."""


def format_player_context(p: dict, attrs: dict, tags: list) -> str:
    """Format a player's context for the LLM prompt."""
    lines = [f"- **{p['name']}** ({p['position'] or '?'}, {p['archetype'] or 'no archetype'}, level {p['level'] or '?'})"]

    if p.get("club"):
        lines.append(f"  Club: {p['club']}, Nation: {p.get('nation') or '?'}")

    if p.get("age"):
        lines.append(f"  Age: {p['age']}")

    if p.get("scouting_notes"):
        # Truncate very long notes
        notes = p["scouting_notes"][:400]
        lines.append(f"  Scout says: \"{notes}\"")

    if p.get("trajectory"):
        parts = [f"Trajectory: {p['trajectory']}"]
        if p.get("loyalty_score"):
            parts.append(f"loyalty {p['loyalty_score']}/20")
        if p.get("clubs_count"):
            parts.append(f"{p['clubs_count']} clubs")
        lines.append(f"  Career: {', '.join(parts)}")

    if tags:
        lines.append(f"  Tags: {', '.join(tags[:10])}")

    if attrs:
        top = sorted(
            [(k, v) for k, v in attrs.items() if v and v > 0],
            key=lambda x: -x[1]
        )[:6]
        if top:
            attr_str = ", ".join(f"{k}={v}" for k, v in top)
            lines.append(f"  Top attributes: {attr_str}")

    return "\n".join(lines)


def main():
    import psycopg2
    import psycopg2.extras
    from datetime import date
    from lib.llm_router import LLMRouter

    print("35 — LLM Personality Reassessment")

    router = LLMRouter(verbose=True)
    if not router.available_providers():
        print("  ERROR: No LLM providers configured")
        return
    print(f"  Providers: {', '.join(router.available_providers())}")

    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ── Load target players ───────────────────────────────────────────────
    query = """
        SELECT
            pp.person_id, pe.name, pe.date_of_birth,
            prof.position, prof.level, prof.archetype, prof.profile_tier,
            pp.ei, pp.sn, pp.tf, pp.jp, pp.competitiveness, pp.coachability,
            pp.is_inferred,
            c.clubname as club, n.name as nation,
            ps.scouting_notes,
            cm.trajectory, cm.loyalty_score, cm.mobility_score, cm.clubs_count
        FROM player_personality pp
        JOIN people pe ON pe.id = pp.person_id
        LEFT JOIN player_profiles prof ON prof.person_id = pp.person_id
        LEFT JOIN clubs c ON c.id = pe.club_id
        LEFT JOIN nations n ON n.id = pe.nation_id
        LEFT JOIN player_status ps ON ps.person_id = pp.person_id
        LEFT JOIN career_metrics cm ON cm.person_id = pp.person_id
        WHERE pe.active = true
    """
    params: list = []

    if not args.force:
        query += " AND pp.is_inferred = true"

    if args.player:
        query += " AND pe.name ILIKE %s"
        params.append(f"%{args.player}%")

    if args.tier:
        query += " AND prof.profile_tier = %s"
        params.append(args.tier)

    if args.min_level:
        query += " AND prof.level >= %s"
        params.append(args.min_level)

    query += " ORDER BY prof.level DESC NULLS LAST"

    if args.limit:
        query += " LIMIT %s"
        params.append(args.limit)

    cur.execute(query, params)
    players = cur.fetchall()
    print(f"  Loaded {len(players)} players for reassessment")

    if not players:
        print("  No players to process.")
        conn.close()
        return

    pids = [p["person_id"] for p in players]

    # ── Load attributes ───────────────────────────────────────────────────
    cur.execute("""
        SELECT player_id, attribute, COALESCE(scout_grade, stat_score) as score
        FROM attribute_grades
        WHERE player_id = ANY(%s)
        AND source IN ('scout_assessment', 'statsbomb', 'fbref')
    """, (pids,))

    attrs_by_pid: dict[int, dict] = {}
    for row in cur.fetchall():
        pid = row["player_id"]
        if pid not in attrs_by_pid:
            attrs_by_pid[pid] = {}
        attrs_by_pid[pid][row["attribute"]] = row["score"]

    # ── Load tags ─────────────────────────────────────────────────────────
    cur.execute("""
        SELECT pt.player_id, t.tag_name
        FROM player_tags pt
        JOIN tags t ON t.id = pt.tag_id
        WHERE pt.player_id = ANY(%s)
    """, (pids,))

    tags_by_pid: dict[int, list] = {}
    for row in cur.fetchall():
        pid = row["player_id"]
        if pid not in tags_by_pid:
            tags_by_pid[pid] = []
        tags_by_pid[pid].append(row["tag_name"])

    # ── Compute ages ──────────────────────────────────────────────────────
    today = date.today()
    for p in players:
        dob = p.get("date_of_birth")
        if dob:
            p["age"] = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        else:
            p["age"] = None

    # ── Process in batches ────────────────────────────────────────────────
    results = []
    total_batches = (len(players) + BATCH_SIZE - 1) // BATCH_SIZE
    changes = Counter()

    for batch_idx in range(total_batches):
        batch = players[batch_idx * BATCH_SIZE: (batch_idx + 1) * BATCH_SIZE]
        print(f"\n  Batch {batch_idx + 1}/{total_batches} ({len(batch)} players)")

        # Build prompt
        player_contexts = []
        for p in batch:
            pid = p["person_id"]
            ctx = format_player_context(
                p,
                attrs_by_pid.get(pid, {}),
                tags_by_pid.get(pid, []),
            )
            player_contexts.append(ctx)

        prompt = PERSONALITY_PROMPT.format(
            player_list="\n\n".join(player_contexts)
        )

        # Call LLM
        llm_result = router.call(prompt, json_mode=True)
        if llm_result is None:
            print(f"    ERROR: LLM call failed, skipping batch")
            continue

        parsed = llm_result.parsed
        if isinstance(parsed, dict):
            # Single player returned as flat dict
            if "ei" in parsed and "name" in parsed:
                parsed = [parsed]
            else:
                for v in parsed.values():
                    if isinstance(v, list):
                        parsed = v
                        break

        if not isinstance(parsed, list):
            print(f"    ERROR: Expected list, got {type(parsed)}")
            continue

        if len(parsed) != len(batch):
            print(f"    WARNING: Got {len(parsed)} results for {len(batch)} players")

        # Match results to players
        for i, (p, r) in enumerate(zip(batch, parsed)):
            if not isinstance(r, dict):
                print(f"    SKIP: Invalid result for {p['name']}")
                continue

            new_ei = int(r.get("ei", p["ei"]))
            new_sn = int(r.get("sn", p["sn"]))
            new_tf = int(r.get("tf", p["tf"]))
            new_jp = int(r.get("jp", p["jp"]))
            new_comp = int(r.get("competitiveness", p["competitiveness"] or 5))
            new_coach = int(r.get("coachability", p["coachability"] or 5))
            reasoning = r.get("reasoning", "")

            # Clamp to valid ranges
            new_ei = max(0, min(100, new_ei))
            new_sn = max(0, min(100, new_sn))
            new_tf = max(0, min(100, new_tf))
            new_jp = max(0, min(100, new_jp))
            new_comp = max(1, min(10, new_comp))
            new_coach = max(1, min(10, new_coach))

            old_code = "".join([
                "A" if p["ei"] >= 50 else "I",
                "X" if p["sn"] >= 50 else "N",
                "S" if p["tf"] >= 50 else "L",
                "C" if p["jp"] >= 50 else "P",
            ])
            new_code = "".join([
                "A" if new_ei >= 50 else "I",
                "X" if new_sn >= 50 else "N",
                "S" if new_tf >= 50 else "L",
                "C" if new_jp >= 50 else "P",
            ])

            code_changed = old_code != new_code
            if code_changed:
                changes["type_changed"] += 1
            else:
                changes["scores_adjusted"] += 1

            flag = " *TYPE CHANGE*" if code_changed else ""
            print(f"    {p['name']}: {old_code}→{new_code} "
                  f"({p['ei']}/{p['sn']}/{p['tf']}/{p['jp']} → {new_ei}/{new_sn}/{new_tf}/{new_jp})"
                  f" comp={new_comp} coach={new_coach}{flag}")
            if reasoning:
                print(f"      LLM: {reasoning[:120]}")

            results.append({
                "person_id": p["person_id"],
                "name": p["name"],
                "ei": new_ei, "sn": new_sn, "tf": new_tf, "jp": new_jp,
                "competitiveness": new_comp, "coachability": new_coach,
                "reasoning": reasoning[:500],
                "old_code": old_code, "new_code": new_code,
            })

        # Rate limit
        if batch_idx < total_batches - 1:
            time.sleep(4)

    # ── Summary ───────────────────────────────────────────────────────────
    print(f"\n  ── Summary ──")
    print(f"  Processed: {len(results)}")
    print(f"  Type changed: {changes['type_changed']}")
    print(f"  Scores adjusted: {changes['scores_adjusted']}")

    if DRY_RUN:
        print(f"\n  DRY RUN — no changes written")
        conn.close()
        return

    # ── Write results ─────────────────────────────────────────────────────
    print(f"\n  Writing {len(results)} assessments...")
    updated = 0
    for r in results:
        try:
            cur.execute("""
                UPDATE player_personality
                SET ei = %s, sn = %s, tf = %s, jp = %s,
                    competitiveness = %s, coachability = %s,
                    confidence = 'Medium',
                    inference_notes = %s,
                    updated_at = NOW()
                WHERE person_id = %s
            """, (
                r["ei"], r["sn"], r["tf"], r["jp"],
                r["competitiveness"], r["coachability"],
                f"LLM: {r['reasoning']}",
                r["person_id"],
            ))
            updated += cur.rowcount
        except Exception as e:
            print(f"    ERROR updating {r['name']}: {e}")

    conn.commit()
    print(f"  Updated {updated} rows")

    # ── Spot-check 3 records ──────────────────────────────────────────────
    if results:
        spot = results[:3]
        spot_pids = [r["person_id"] for r in spot]
        cur.execute("""
            SELECT person_id, ei, sn, tf, jp, competitiveness, coachability, confidence
            FROM player_personality
            WHERE person_id = ANY(%s)
        """, (spot_pids,))
        print(f"\n  ── Spot-check ──")
        for row in cur.fetchall():
            code = "".join([
                "A" if row["ei"] >= 50 else "I",
                "X" if row["sn"] >= 50 else "N",
                "S" if row["tf"] >= 50 else "L",
                "C" if row["jp"] >= 50 else "P",
            ])
            print(f"    {row['person_id']}: {code} ({row['ei']}/{row['sn']}/{row['tf']}/{row['jp']}) "
                  f"comp={row['competitiveness']} coach={row['coachability']} conf={row['confidence']}")

    router.print_stats()
    conn.close()
    print("\n  Done.")


if __name__ == "__main__":
    main()
