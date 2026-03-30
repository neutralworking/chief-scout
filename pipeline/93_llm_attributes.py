"""
93_llm_attributes.py — LLM-inferred attribute scores for thin models.

Models like Controller, Engine, and Commander have poor stat coverage because
their attributes (anticipation, composure, decisions, tempo, intensity,
pressing, etc.) are mental/tactical qualities that stat sources can't measure.

This script uses an LLM to estimate missing attribute scores based on:
- Known attributes and grades
- Scouting notes
- Position, level, archetype, best role

Writes to attribute_grades with source='llm_inferred'.
Priority is between computed(1) and understat/kaggle(2).

Usage:
    python 93_llm_attributes.py                     # all eligible players
    python 93_llm_attributes.py --top 500           # top 500 by level
    python 93_llm_attributes.py --player "Rodri"    # single player
    python 93_llm_attributes.py --dry-run            # preview without writing
    python 93_llm_attributes.py --force              # overwrite existing llm_inferred
    python 93_llm_attributes.py --min-level 75       # only level 75+
"""
from __future__ import annotations

import argparse
import json
import time

import psycopg2
import psycopg2.extras

from config import POSTGRES_DSN
from lib.llm_router import LLMRouter
from lib.models import MODEL_ATTRIBUTES, SOURCE_PRIORITY

# ── CLI ────────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="LLM attribute inference for thin models")
parser.add_argument("--top", type=int, default=None, help="Top N players by level")
parser.add_argument("--player", default=None, help="Single player by name")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true", help="Overwrite existing llm_inferred grades")
parser.add_argument("--min-level", type=int, default=70, help="Minimum player level (default: 70)")
parser.add_argument("--batch-size", type=int, default=10, help="Players per LLM batch")
args = parser.parse_args()

BATCH_SIZE = args.batch_size
INTER_BATCH_DELAY = 8  # seconds between batches — Groq free tier is 30 RPM

# Models with poor stat coverage — these are what we're inferring
THIN_MODELS = ["Controller", "Engine", "Commander"]
MIN_COVERAGE = 3  # infer if player has < this many attrs for a model

# All attributes we might infer (union of thin model attrs)
ALL_THIN_ATTRS = set()
for model in THIN_MODELS:
    ALL_THIN_ATTRS.update(MODEL_ATTRIBUTES[model])

# ── Connections ───────────────────────────────────────────────────────────────

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = False
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
router = LLMRouter()

# ── Fetch eligible players ────────────────────────────────────────────────────


def fetch_players():
    """Get players who need attribute inference."""
    where_parts = ["pp.position IS NOT NULL", "pp.level IS NOT NULL"]
    params = []

    if args.player:
        where_parts.append("p.name ILIKE %s")
        params.append(f"%{args.player}%")
    else:
        where_parts.append("pp.level >= %s")
        params.append(args.min_level)

    where_sql = " AND ".join(where_parts)
    limit_sql = f"LIMIT {args.top}" if args.top else ""

    cur.execute(f"""
        SELECT p.id, p.name,
               EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
               pp.position, pp.level, pp.earned_archetype, pp.archetype,
               pp.best_role, pp.best_role_score, pp.blueprint,
               c.clubname AS club, n.name AS nation
        FROM people p
        JOIN player_profiles pp ON pp.person_id = p.id
        LEFT JOIN clubs c ON p.club_id = c.id
        LEFT JOIN nations n ON p.nation_id = n.id
        WHERE {where_sql}
        ORDER BY pp.level DESC NULLS LAST
        {limit_sql}
    """, params)
    return cur.fetchall()


def get_existing_grades(player_ids):
    """Get all existing non-eafc grades for a set of players."""
    cur.execute("""
        SELECT player_id, LOWER(REPLACE(attribute, ' ', '_')) AS attr,
               scout_grade, stat_score, source
        FROM attribute_grades
        WHERE player_id = ANY(%s)
        AND source != 'eafc_inferred'
        AND (scout_grade > 0 OR stat_score > 0)
        ORDER BY player_id, attribute
    """, (player_ids,))
    grades = {}
    for row in cur.fetchall():
        grades.setdefault(row["player_id"], []).append(row)
    return grades


def get_scouting_notes(player_ids):
    """Get scouting notes for a set of players."""
    cur.execute("""
        SELECT person_id, scouting_notes
        FROM player_status
        WHERE person_id = ANY(%s) AND scouting_notes IS NOT NULL
    """, (player_ids,))
    return {row["person_id"]: row["scouting_notes"] for row in cur.fetchall()}


def find_missing_attrs(player_grades):
    """For each thin model, find which attrs are missing for this player."""
    existing_attrs = {g["attr"] for g in player_grades}
    missing = {}
    for model in THIN_MODELS:
        model_attrs = MODEL_ATTRIBUTES[model]
        covered = [a for a in model_attrs if a in existing_attrs]
        if len(covered) < MIN_COVERAGE:
            missing_attrs = [a for a in model_attrs if a not in existing_attrs]
            if missing_attrs:
                missing[model] = missing_attrs
    return missing


def format_known_grades(player_grades):
    """Format existing grades as a readable summary for the LLM."""
    lines = []
    for g in sorted(player_grades, key=lambda x: x["attr"]):
        score = g["scout_grade"] if g["scout_grade"] and g["scout_grade"] > 0 else None
        if score is None and g["stat_score"] and g["stat_score"] > 0:
            score = round(g["stat_score"] * 2, 1)  # normalise stat_score to 0-20
        if score:
            lines.append(f"  {g['attr']}: {score}/20 ({g['source']})")
    return "\n".join(lines) if lines else "  (no grades available)"


# ── LLM Prompt ────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert football scout and analyst. You estimate player attribute scores based on available evidence.

SCORING SCALE: 1-20 where:
- 1-5: Poor/below average
- 6-8: Average for professional level
- 9-11: Good, above average
- 12-14: Very good, top-flight quality
- 15-17: Excellent, elite level
- 18-20: World class, exceptional

IMPORTANT RULES:
- Be conservative — it's better to estimate slightly low than high
- Use known attributes as anchors (e.g., if passing is 14, composure is likely 12-16)
- Position context matters: a DM with high interceptions likely has good anticipation
- Level context: a level 85+ player's mental attributes should generally be 12+
- Scouting notes are the strongest signal — weight them heavily
- If you truly have no basis to estimate, give a moderate score (8-10) rather than guessing extreme values

ATTRIBUTE DEFINITIONS:
- anticipation: Reading the game before it happens, spatial awareness of developing play
- composure: Performing under pressure, decision quality in tight situations
- decisions: Choosing the right option consistently — when to pass, shoot, hold
- tempo: Controlling the speed of play, knowing when to speed up or slow down
- intensity: Work rate off the ball, energy in closing down and pressing
- pressing: Effectiveness and intelligence of pressing actions
- stamina: Physical endurance to maintain effort across 90 minutes
- versatility: Ability to adapt to different tactical demands and positions
- communication: Vocal leadership, organising teammates, directing play
- concentration: Maintaining focus throughout the match, avoiding lapses
- drive: Inner motivation, competitive fire, desire to influence the game
- leadership: Authority on the pitch, ability to raise the level of teammates

Respond ONLY with a JSON object mapping attribute names to integer scores (1-20)."""


def build_prompt(players_batch):
    """Build a batch prompt for multiple players."""
    parts = []
    for p in players_batch:
        missing = p["_missing"]
        all_missing_attrs = []
        for model, attrs in missing.items():
            all_missing_attrs.extend(attrs)
        all_missing_attrs = sorted(set(all_missing_attrs))

        section = f"""### {p['name']} ({p['position']}, Level {p['level']})
Club: {p.get('club') or 'Unknown'} | Nation: {p.get('nation') or 'Unknown'} | Age: {p.get('age') or '?'}
Archetype: {p.get('earned_archetype') or p.get('archetype') or 'Unknown'} | Role: {p.get('best_role') or 'Unknown'}

Known attributes:
{p['_known_grades']}

Scouting notes: {p.get('_notes') or '(none available)'}

ESTIMATE THESE ATTRIBUTES: {', '.join(all_missing_attrs)}"""
        parts.append(section)

    prompt = f"""Estimate missing attribute scores for these {len(parts)} players.

For each player, return their scores as a JSON object within an outer object keyed by player name.

Example response format:
{{
  "Player Name": {{"anticipation": 12, "composure": 14, "tempo": 11}},
  "Other Player": {{"intensity": 13, "pressing": 15}}
}}

{chr(10).join(parts)}"""
    return prompt


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("LLM Attribute Inference")
    print(f"  Min level: {args.min_level}")
    print(f"  Dry run: {args.dry_run}")
    print(f"  Force: {args.force}")

    # Step 1: Find eligible players
    players = fetch_players()
    print(f"  Candidate players: {len(players)}")

    if not players:
        print("  No players found.")
        return

    player_ids = [p["id"] for p in players]

    # Step 2: Get existing grades + notes
    all_grades = get_existing_grades(player_ids)
    all_notes = get_scouting_notes(player_ids)

    # Step 3: Filter to players who actually need inference
    eligible = []
    for p in players:
        pid = p["id"]
        grades = all_grades.get(pid, [])
        missing = find_missing_attrs(grades)
        if not missing:
            continue

        # If not --force, skip players who already have llm_inferred grades
        if not args.force:
            cur.execute("""
                SELECT COUNT(*) FROM attribute_grades
                WHERE player_id = %s AND source = 'llm_inferred'
            """, (pid,))
            if cur.fetchone()["count"] > 0:
                continue

        p["_missing"] = missing
        p["_known_grades"] = format_known_grades(grades)
        p["_notes"] = all_notes.get(pid)
        eligible.append(p)

    print(f"  Players needing inference: {len(eligible)}")

    if not eligible:
        print("  All players already have sufficient data.")
        return

    # Step 4: Process in batches
    total_written = 0
    total_errors = 0

    for i in range(0, len(eligible), BATCH_SIZE):
        batch = eligible[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(eligible) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"\n  Batch {batch_num}/{total_batches} ({len(batch)} players)...")

        prompt = build_prompt(batch)
        result = router.call(prompt, system=SYSTEM_PROMPT, json_mode=True)

        if not result or not result.parsed:
            print(f"    ERROR: LLM returned no parseable JSON")
            total_errors += len(batch)
            continue

        data = result.parsed
        if not isinstance(data, dict):
            print(f"    ERROR: Expected dict, got {type(data)}")
            total_errors += len(batch)
            continue

        # Match results back to players
        for p in batch:
            name = p["name"]
            # Try exact match, then fuzzy
            scores = data.get(name)
            if scores is None:
                # Try case-insensitive partial match
                for key in data:
                    if key.lower() == name.lower() or name.lower() in key.lower():
                        scores = data[key]
                        break

            if not scores or not isinstance(scores, dict):
                print(f"    SKIP {name}: no scores in response")
                total_errors += 1
                continue

            # Validate and write
            written = 0
            for attr, score in scores.items():
                attr_clean = attr.lower().replace(" ", "_")
                if attr_clean not in ALL_THIN_ATTRS:
                    continue
                if not isinstance(score, (int, float)):
                    continue
                score = max(1, min(20, int(round(score))))

                if args.dry_run:
                    print(f"    [DRY] {name}: {attr_clean} = {score}/20")
                    written += 1
                else:
                    # Upsert: only write if no higher-priority source exists
                    cur.execute("""
                        INSERT INTO attribute_grades (player_id, attribute, scout_grade, source)
                        VALUES (%s, %s, %s, 'llm_inferred')
                        ON CONFLICT (player_id, attribute, source)
                        DO UPDATE SET scout_grade = EXCLUDED.scout_grade
                        WHERE attribute_grades.source = 'llm_inferred'
                    """, (p["id"], attr_clean, score))
                    written += 1

            if written > 0:
                total_written += written
                if not args.dry_run:
                    print(f"    {name}: {written} attrs written ({list(scores.keys())})")
            else:
                total_errors += 1

        if not args.dry_run:
            conn.commit()

        if i + BATCH_SIZE < len(eligible):
            time.sleep(INTER_BATCH_DELAY)
            # Re-enable providers whose rate limits may have reset
            router.reset_disabled()

    # Summary
    print(f"\n── Summary ──")
    print(f"  Players processed: {len(eligible)}")
    print(f"  Attributes written: {total_written}")
    print(f"  Errors/skips: {total_errors}")
    router.print_stats()

    if not args.dry_run:
        print("\n  Refreshing materialized view...")
        cur2 = conn.cursor()
        cur2.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY player_intelligence_card")
        conn.commit()
        print("  Done.")


if __name__ == "__main__":
    main()
