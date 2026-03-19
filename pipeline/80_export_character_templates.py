"""
80_export_character_templates.py — Export player templates for Kickoff Clash character generation.

Reads KC-flagged players (kc=true) from Chief Scout and exports them as JSON
templates. These templates are consumed by Kickoff Clash's seed_characters.py
to generate fictional comedic characters with Gemini Flash.

Output: pipeline/.cache/kc_templates.json

Usage:
    python pipeline/80_export_character_templates.py [--all] [--dry-run]

Flags:
    --all       Export all players (not just kc=true flagged ones)
    --dry-run   Print stats without writing file
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

from config import POSTGRES_DSN, CACHE_DIR

DRY_RUN = "--dry-run" in sys.argv
EXPORT_ALL = "--all" in sys.argv

CACHE_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = CACHE_DIR / "kc_templates.json"

# ── Query ─────────────────────────────────────────────────────────────────────

QUERY = """
SELECT
    p.id AS person_id,
    p.name,
    p.active,
    pp.position,
    pp.archetype,
    pp.blueprint,
    pp.level,
    pp.peak,
    pp.overall,
    pper.ei, pper.sn, pper.tf, pper.jp,
    pper.competitiveness, pper.coachability,
    CASE WHEN pper.ei IS NOT NULL THEN
        CONCAT(
            CASE WHEN pper.ei >= 50 THEN 'A' ELSE 'I' END,
            CASE WHEN pper.sn >= 50 THEN 'X' ELSE 'N' END,
            CASE WHEN pper.tf >= 50 THEN 'S' ELSE 'L' END,
            CASE WHEN pper.jp >= 50 THEN 'C' ELSE 'P' END
        )
    END AS personality_code,
    ps.scouting_notes,
    n.name AS nation,
    c.clubname AS club
FROM people p
LEFT JOIN player_profiles pp ON pp.person_id = p.id
LEFT JOIN player_personality pper ON pper.person_id = p.id
LEFT JOIN player_status ps ON ps.person_id = p.id
LEFT JOIN nations n ON n.id = p.nation_id
LEFT JOIN clubs c ON c.id = p.club_id
WHERE pp.archetype IS NOT NULL
  AND pper.ei IS NOT NULL
"""

QUERY_KC_ONLY = QUERY + "  AND p.kc = true"
QUERY_ALL = QUERY

# Also fetch top attributes per player
ATTRS_QUERY = """
SELECT
    player_id AS person_id,
    attribute,
    COALESCE(scout_grade, stat_score, 0) AS score,
    source
FROM attribute_grades
WHERE player_id = ANY(%s)
  AND COALESCE(scout_grade, stat_score, 0) > 0
ORDER BY player_id, COALESCE(scout_grade, stat_score, 0) DESC
"""


def main():
    if not POSTGRES_DSN:
        print("ERROR: POSTGRES_DSN not set in environment")
        sys.exit(1)

    conn = psycopg2.connect(POSTGRES_DSN)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Fetch players
    query = QUERY_ALL if EXPORT_ALL else QUERY_KC_ONLY
    cur.execute(query)
    players = cur.fetchall()

    print(f"Found {len(players)} template players ({('all' if EXPORT_ALL else 'kc=true only')})")

    if not players:
        print("No players found. Flag players with kc=true on the review screen first.")
        conn.close()
        return

    # Fetch attributes
    pids = [p["person_id"] for p in players]
    cur.execute(ATTRS_QUERY, (pids,))
    all_attrs = cur.fetchall()

    # Group attributes by player
    attrs_by_player: dict[int, list[dict]] = {}
    for a in all_attrs:
        pid = a["person_id"]
        if pid not in attrs_by_player:
            attrs_by_player[pid] = []
        attrs_by_player[pid].append({
            "attribute": a["attribute"],
            "score": float(a["score"]),
            "source": a["source"],
        })

    # Build templates
    templates = []
    for p in players:
        pid = p["person_id"]
        # Top 10 attributes
        top_attrs = sorted(
            attrs_by_player.get(pid, []),
            key=lambda x: x["score"],
            reverse=True,
        )[:10]

        # Determine rarity from overall (current ability, not peak)
        ovr = p.get("overall") or 50
        if ovr >= 83:
            rarity = "legendary"
        elif ovr >= 76:
            rarity = "epic"
        elif ovr >= 68:
            rarity = "rare"
        elif ovr >= 58:
            rarity = "uncommon"
        else:
            rarity = "common"

        templates.append({
            "person_id": pid,
            "name": p["name"],
            "position": p["position"],
            "archetype": p["archetype"],
            "blueprint": p["blueprint"],
            "personality_code": p["personality_code"],
            "level": p["level"],
            "peak": p["peak"],
            "overall": p["overall"],
            "ei": p["ei"],
            "sn": p["sn"],
            "tf": p["tf"],
            "jp": p["jp"],
            "competitiveness": p["competitiveness"],
            "coachability": p["coachability"],
            "scouting_notes": p["scouting_notes"],
            "nation": p["nation"],
            "club": p["club"],
            "active": p["active"],
            "suggested_rarity": rarity,
            "top_attributes": top_attrs,
        })

    conn.close()

    # Print summary
    by_rarity = {}
    by_archetype = {}
    by_position = {}
    for t in templates:
        by_rarity[t["suggested_rarity"]] = by_rarity.get(t["suggested_rarity"], 0) + 1
        by_archetype[t["archetype"]] = by_archetype.get(t["archetype"], 0) + 1
        by_position[t["position"]] = by_position.get(t["position"], 0) + 1

    print(f"\nRarity distribution:")
    for r in ["legendary", "epic", "rare", "uncommon", "common"]:
        print(f"  {r}: {by_rarity.get(r, 0)}")

    print(f"\nArchetype distribution:")
    for a, c in sorted(by_archetype.items(), key=lambda x: -x[1]):
        print(f"  {a}: {c}")

    print(f"\nPosition distribution:")
    for p, c in sorted(by_position.items(), key=lambda x: -x[1]):
        print(f"  {p}: {c}")

    if DRY_RUN:
        print(f"\n[DRY RUN] Would write {len(templates)} templates to {OUTPUT_PATH}")
        return

    # Write output
    with open(OUTPUT_PATH, "w") as f:
        json.dump(templates, f, indent=2, default=str)

    print(f"\nWrote {len(templates)} templates to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
