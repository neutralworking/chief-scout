"""
91_legend_backfill.py — Backfill missing data for legends (retired players).

Fills gaps so the similarity engine has more factors to score on:
  1. Pillar estimation — attribute_grades → technical/tactical/mental/physical scores
  2. Trait inference — archetype + top grades → player_trait_scores
  3. Side inference — preferred_foot + position → side

Usage:
    python 91_legend_backfill.py              # backfill legends
    python 91_legend_backfill.py --dry-run    # preview
    python 91_legend_backfill.py --force      # overwrite existing data
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from lib.db import require_conn, get_dict_cursor

parser = argparse.ArgumentParser(description="Backfill legend data for similarity engine")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true", help="Overwrite existing data")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force

# ── Pillar category mappings (using actual attribute_grades.attribute names) ──
# DB attributes: acceleration, aerial_duels, aggression, awareness, balance,
#   blocking, carries, clearances, close_range, composure, creativity, crossing,
#   discipline, duels, first_touch, footwork, guile, heading, intensity,
#   interceptions, jumping, long_range, marking, mental, mid_range, movement,
#   pace, pass_accuracy, pass_range, penalties, physical, positioning, pressing,
#   reactions, shielding, skills, stamina, tackling, tactical, take_ons,
#   technical, through_balls, throwing, versatility, vision, volleys

TECHNICAL_ATTRS = {
    "close_range", "take_ons", "crossing", "pass_accuracy", "first_touch",
    "skills", "long_range", "volleys", "through_balls", "penalties",
}
TACTICAL_ATTRS = {
    "positioning", "vision", "movement", "awareness", "composure",
    "tactical", "pressing", "versatility",
}
MENTAL_ATTRS = {
    "aggression", "creativity", "composure", "mental",
    "reactions", "discipline", "guile", "intensity",
}
PHYSICAL_ATTRS = {
    "pace", "acceleration", "stamina", "physical", "jumping",
    "balance", "aerial_duels", "shielding",
}

MIN_GRADES_PER_PILLAR = 3

# ── Trait inference rules ────────────────────────────────────────────────────

TRAIT_RULES = [
    # (archetype_keywords, attribute, threshold, trait_name)
    # Grades are on 1-20 scale (EAFC/stat-derived), so threshold 15 ≈ top quartile
    ({"hitman", "spearhead", "striker", "poacher", "target_man", "target man"},
     "close_range", 15, "Clinical Finisher"),
    ({"maestro", "creator", "playmaker", "architect", "virtuoso", "regista"},
     "vision", 15, "Playmaker"),
    ({"engine", "sprinter", "outlet", "speedster"},
     "pace", 15, "Speed Merchant"),
    ({"destroyer", "anchor", "sentinel", "rock"},
     "tackling", 15, "Ball Winner"),
    (None, "take_ons", 15, "Dribbler"),
    (None, "pass_accuracy", 15, "Ball Progressor"),
    (None, "mental", 15, "Leader"),
    (None, "heading", 15, "Aerial Threat"),
]

CENTRAL_POSITIONS = {"GK", "CD", "DM", "CM", "AM", "CF"}


def main():
    conn = require_conn()
    cur = get_dict_cursor(conn)

    print("91 — Legend Backfill for Similarity Engine")
    print(f"  Dry run: {DRY_RUN}")
    print(f"  Force:   {FORCE}")

    # ── Identify legends ─────────────────────────────────────────────────────
    cur.execute("""
        SELECT p.id, p.name, p.preferred_foot,
               pp.position, pp.earned_archetype, pp.archetype,
               pp.technical_score, pp.tactical_score, pp.mental_score, pp.physical_score,
               pp.side
        FROM people p
        JOIN player_profiles pp ON pp.person_id = p.id
        WHERE p.active = false
    """)
    legends = cur.fetchall()
    print(f"  Found {len(legends)} legends (active=false)")

    # ── Load all attribute grades for legends ────────────────────────────────
    legend_ids = [l["id"] for l in legends]
    if not legend_ids:
        print("  No legends found. Done.")
        conn.close()
        return

    cur.execute("""
        SELECT player_id, attribute, scout_grade, stat_score
        FROM attribute_grades
        WHERE player_id = ANY(%s)
    """, (legend_ids,))
    all_grades = cur.fetchall()

    # Build per-player grade dicts: {player_id: {attribute: best_score}}
    player_grades = {}
    for g in all_grades:
        pid = g["player_id"]
        attr = g["attribute"]
        score = g["scout_grade"] or g["stat_score"] or 0
        if pid not in player_grades:
            player_grades[pid] = {}
        # Keep highest score per attribute
        if attr not in player_grades[pid] or score > player_grades[pid][attr]:
            player_grades[pid][attr] = score

    # ── Load existing traits ─────────────────────────────────────────────────
    cur.execute("""
        SELECT DISTINCT player_id
        FROM player_trait_scores
        WHERE player_id = ANY(%s)
    """, (legend_ids,))
    has_traits = {r["player_id"] for r in cur.fetchall()}

    # ── Step 1: Pillar estimation ────────────────────────────────────────────
    print("\n  Step 1: Pillar estimation")
    pillar_updates = []
    for legend in legends:
        pid = legend["id"]
        # Skip if already has pillars (unless --force)
        if not FORCE and legend["technical_score"] is not None:
            continue
        grades = player_grades.get(pid, {})
        if not grades:
            continue

        pillars = {}
        for pillar_name, attrs in [
            ("technical_score", TECHNICAL_ATTRS),
            ("tactical_score", TACTICAL_ATTRS),
            ("mental_score", MENTAL_ATTRS),
            ("physical_score", PHYSICAL_ATTRS),
        ]:
            matched = [grades[a] for a in attrs if a in grades and grades[a] > 0]
            if len(matched) >= MIN_GRADES_PER_PILLAR:
                pillars[pillar_name] = round(sum(matched) / len(matched), 1)

        if pillars:
            pillar_updates.append((pid, legend["name"], pillars))

    print(f"    {len(pillar_updates)} legends to update")
    if pillar_updates and not DRY_RUN:
        for pid, name, pillars in pillar_updates:
            sets = ", ".join(f"{k} = %s" for k in pillars)
            vals = list(pillars.values()) + [pid]
            cur.execute(
                f"UPDATE player_profiles SET {sets} WHERE person_id = %s",
                vals,
            )
        conn.commit()
        print(f"    Wrote {len(pillar_updates)} pillar updates")
    elif pillar_updates:
        for pid, name, pillars in pillar_updates[:10]:
            scores = ", ".join(f"{k.replace('_score','')}={v}" for k, v in pillars.items())
            print(f"      {name}: {scores}")
        if len(pillar_updates) > 10:
            print(f"      ... and {len(pillar_updates) - 10} more")

    # ── Step 2: Trait inference ──────────────────────────────────────────────
    print("\n  Step 2: Trait inference")
    trait_inserts = []
    for legend in legends:
        pid = legend["id"]
        # Skip if already has traits (unless --force)
        if not FORCE and pid in has_traits:
            continue
        archetype = (legend["earned_archetype"] or legend["archetype"] or "").lower().replace(" ", "_")
        if not archetype:
            continue
        grades = player_grades.get(pid, {})
        if not grades:
            continue

        inferred = set()
        for arch_keywords, attr, threshold, trait_name in TRAIT_RULES:
            if attr not in grades or grades[attr] < threshold:
                continue
            # If archetype keywords specified, check match
            if arch_keywords is not None:
                if not any(kw in archetype for kw in arch_keywords):
                    continue
            if trait_name not in inferred:
                inferred.add(trait_name)
                trait_inserts.append((pid, legend["name"], trait_name))

    print(f"    {len(trait_inserts)} traits to insert for {len(set(t[0] for t in trait_inserts))} legends")
    if trait_inserts and not DRY_RUN:
        for pid, name, trait in trait_inserts:
            cur.execute("""
                INSERT INTO player_trait_scores (player_id, trait, category, severity, source)
                VALUES (%s, %s, 'style', 7, 'inferred')
                ON CONFLICT (player_id, trait, source) DO NOTHING
            """, (pid, trait))
        conn.commit()
        print(f"    Wrote {len(trait_inserts)} traits")
    elif trait_inserts:
        by_player = {}
        for pid, name, trait in trait_inserts:
            by_player.setdefault(name, []).append(trait)
        for name, traits in list(by_player.items())[:10]:
            print(f"      {name}: {', '.join(traits)}")
        if len(by_player) > 10:
            print(f"      ... and {len(by_player) - 10} more players")

    # ── Step 3: Side inference ───────────────────────────────────────────────
    print("\n  Step 3: Side inference")
    side_updates = []
    for legend in legends:
        pid = legend["id"]
        if not FORCE and legend["side"] is not None:
            continue
        foot = (legend["preferred_foot"] or "").lower()
        position = legend["position"] or ""

        if foot == "left" and position not in CENTRAL_POSITIONS:
            side = "L"
        elif foot == "right" and position not in CENTRAL_POSITIONS:
            side = "R"
        elif foot == "both" or position in CENTRAL_POSITIONS:
            side = "C"
        elif foot == "left":
            side = "L"
        elif foot == "right":
            side = "R"
        else:
            continue  # no foot data, can't infer

        side_updates.append((pid, legend["name"], side))

    print(f"    {len(side_updates)} legends to update")
    if side_updates and not DRY_RUN:
        for pid, name, side in side_updates:
            cur.execute(
                "UPDATE player_profiles SET side = %s WHERE person_id = %s",
                (side, pid),
            )
        conn.commit()
        print(f"    Wrote {len(side_updates)} side updates")
    elif side_updates:
        for pid, name, side in side_updates[:10]:
            print(f"      {name}: {side}")
        if len(side_updates) > 10:
            print(f"      ... and {len(side_updates) - 10} more")

    # ── Summary ──────────────────────────────────────────────────────────────
    print("\n  Summary:")
    print(f"    Pillar estimates: {len(pillar_updates)}")
    print(f"    Traits inferred:  {len(trait_inserts)} ({len(set(t[0] for t in trait_inserts))} players)")
    print(f"    Sides inferred:   {len(side_updates)}")
    if DRY_RUN:
        print("    (dry run — nothing written)")

    conn.close()


if __name__ == "__main__":
    main()
