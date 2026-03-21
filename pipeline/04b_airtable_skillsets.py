"""
04b_airtable_skillsets.py — Compute skillsets (Primary-Secondary) from Airtable scout grades.

Pulls scout-graded players from Airtable, computes model scores using the same
logic as pipeline 04, and writes the compound skillset to player_profiles.archetype.

Only overwrites players whose current archetype is derived from EAFC ratings
(i.e. no real stat sources in attribute_grades).

Usage:
    python pipeline/04b_airtable_skillsets.py              # run
    python pipeline/04b_airtable_skillsets.py --dry-run    # preview
    python pipeline/04b_airtable_skillsets.py --player 14397  # single player debug
"""

import argparse
import os
import sys
import urllib.parse

import psycopg2
import requests

# Reuse pipeline 04's model scoring logic
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from lib.models import MODEL_ATTRIBUTES, ATTR_ALIASES

# ── Grade mapping ────────────────────────────────────────────────────────────
# Airtable text grades → numeric on 0-20 scale (same as scout_grade)
GRADE_TO_SCORE = {
    "Poor": 6,
    "Average": 12,
    "Good": 16,
    "Excellent": 19,
}

# Airtable column → DB attribute name
AIRTABLE_ATTR_MAP = {
    "Acceleration": "acceleration",
    "Aerial Duels": "aerial_duels",
    "Aggression": "aggression",
    "Anticipation": "anticipation",
    "Awareness": "awareness",
    "Balance": "balance",
    "Blocking": "blocking",
    "Carries": "carries",
    "Clearances": "clearances",
    "CloseRange": "close_range",
    "Communication": "communication",
    "Composure": "composure",
    "Concentration": "concentration",
    "Creativity": "creativity",
    "Crossing": "crossing",
    "Decisions": "decisions",
    "Discipline": "discipline",
    "Drive": "drive",
    "Duels": "duels",
    "First Touch": "first_touch",
    "Heading": "heading",
    "Intensity": "intensity",
    "Interceptions": "interceptions",
    "Jumping": "jumping",
    "Leadership": "leadership",
    "LongRange": "long_range",
    "Marking": "marking",
    "MidRange": "mid_range",
    "Movement": "movement",
    "Pace": "pace",
    "PassAccuracy": "pass_accuracy",
    "PassRange": "pass_range",
    "Penalties": "penalties",
    "Positioning": "positioning",
    "Pressing": "pressing",
    "Set Pieces": "set_pieces",
    "Shielding": "shielding",
    "Skills": "skills",
    "Stamina": "stamina",
    "Tackling": "tackling",
    "Takeons": "take_ons",
    "Tempo": "tempo",
    "ThroughBalls": "through_balls",
    "Throwing": "throwing",
    "Unpredictability": "unpredictability",
    "Vision": "vision",
    "Volleys": "volleys",
}

# Compound model categories — secondary must differ from primary's category
MODEL_COMPOUNDS = {
    "Controller": "mental", "Commander": "mental", "Creator": "mental",
    "Target": "physical", "Sprinter": "physical", "Powerhouse": "physical",
    "Cover": "tactical", "Engine": "tactical", "Destroyer": "tactical",
    "Dribbler": "technical", "Passer": "technical", "Striker": "technical",
    "GK": "gk",
}

# Position-based affinity tiebreakers (same as pipeline 04)
POS_AFFINITY = {
    "CF": ["Striker", "Target"],
    "WF": ["Dribbler", "Striker", "Creator"],
    "AM": ["Creator", "Dribbler"],
    "CM": ["Controller", "Engine", "Passer"],
    "WM": ["Engine", "Dribbler", "Passer"],
    "DM": ["Cover", "Destroyer", "Controller"],
    "CD": ["Cover", "Destroyer", "Commander"],
    "WD": ["Engine", "Cover", "Sprinter"],
}


def score_models(attr_scores: dict[str, float], position: str | None) -> dict[str, float]:
    """Score all 13 SACROSANCT models from attribute scores (0-100)."""
    scores = {}
    pos = position or ""
    affinity_set = set(POS_AFFINITY.get(pos, []))

    for model, core_attrs in MODEL_ATTRIBUTES.items():
        vals = [attr_scores.get(a) for a in core_attrs]
        vals = [v for v in vals if v is not None]

        if len(vals) < 2:
            scores[model] = 0.0
            continue

        raw = sum(vals) / len(vals)

        if model == "GK" and pos != "GK":
            raw *= 0.3
        elif model != "GK" and pos == "GK":
            raw *= 0.3

        if model in affinity_set:
            raw += 0.3

        scores[model] = round(raw, 1)

    return scores


def best_model(scores: dict[str, float], threshold: float = 15.0) -> str | None:
    """Return compound archetype (Primary-Secondary) from top two model scores."""
    if not scores:
        return None
    ranked = sorted(scores.items(), key=lambda x: -x[1])
    if not ranked or ranked[0][1] < threshold:
        return None

    primary = ranked[0][0]
    primary_score = ranked[0][1]

    if len(ranked) > 1:
        primary_cat = MODEL_COMPOUNDS.get(primary)
        for secondary_name, secondary_score in ranked[1:]:
            secondary_cat = MODEL_COMPOUNDS.get(secondary_name)
            if (secondary_score >= threshold
                    and secondary_score >= primary_score * 0.70
                    and primary_cat != secondary_cat):
                return f"{primary}-{secondary_name}"
            if secondary_score < threshold:
                break
    return primary


def fetch_airtable_players(api_key: str, base_id: str, table_id: str) -> list[dict]:
    """Fetch all records from Airtable with scout grades."""
    url = f"https://api.airtable.com/v0/{base_id}/{urllib.parse.quote(table_id)}"
    headers = {"Authorization": f"Bearer {api_key}"}
    all_records = []
    offset = None

    while True:
        params = {"pageSize": "100"}
        if offset:
            params["offset"] = offset
        r = requests.get(url, headers=headers, params=params)
        r.raise_for_status()
        data = r.json()
        all_records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            break

    return all_records


def extract_grades(fields: dict) -> tuple[dict[str, float], bool]:
    """Convert Airtable text grades to attribute scores (0-100).

    Returns (scores_dict, has_non_average) — Average grades ARE included
    in scoring (they're 60/100), but we track whether any non-Average
    grades exist to filter out ungraded players.
    """
    scores = {}
    has_non_average = False
    for at_col, db_attr in AIRTABLE_ATTR_MAP.items():
        grade_text = fields.get(at_col)
        if not grade_text:
            continue
        numeric = GRADE_TO_SCORE.get(grade_text)
        if numeric is None:
            continue
        if grade_text != "Average":
            has_non_average = True
        # Apply alias mapping
        attr = ATTR_ALIASES.get(db_attr, db_attr)
        # Convert to 0-100 scale (scores are on 0-20)
        scores[attr] = (numeric / 20.0) * 100.0
    return scores, has_non_average


def main():
    parser = argparse.ArgumentParser(description="Compute skillsets from Airtable scout grades")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--player", type=int, help="Debug a single player ID")
    args = parser.parse_args()

    api_key = os.environ.get("AIRTABLE_API_KEY", "")
    base_id = "appj4mTUt8xNqB3cD"
    table_id = "tblMFwJ4tWXT8ZMnM"
    dsn = os.environ.get("POSTGRES_DSN", "")

    if not api_key:
        print("ERROR: AIRTABLE_API_KEY not set")
        sys.exit(1)
    if not dsn:
        print("ERROR: POSTGRES_DSN not set")
        sys.exit(1)

    # ── Fetch Airtable data ──
    print("Fetching players from Airtable...")
    records = fetch_airtable_players(api_key, base_id, table_id)
    print(f"  {len(records)} total records")

    # ── Filter to scout-graded players ──
    graded = []
    for rec in records:
        fields = rec.get("fields", {})
        pid = fields.get("ID")
        if not pid:
            continue
        grades, has_non_average = extract_grades(fields)
        if not has_non_average:
            continue
        graded.append({
            "person_id": int(pid),
            "name": fields.get("Name", "?"),
            "active": fields.get("Active", True),
            "grades": grades,
        })

    print(f"  {len(graded)} with scout grades")

    if args.player:
        graded = [g for g in graded if g["person_id"] == args.player]
        if not graded:
            print(f"  Player {args.player} not found or has no scout grades")
            sys.exit(1)

    # ── Get positions + current archetype data from DB ──
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    pids = [g["person_id"] for g in graded]
    cur.execute("""
        SELECT pp.person_id, pp.position, pp.archetype, pp.archetype_tier, p.active
        FROM player_profiles pp
        JOIN people p ON p.id = pp.person_id
        WHERE pp.person_id = ANY(%s)
    """, (pids,))
    profiles = {row[0]: {"position": row[1], "archetype": row[2], "tier": row[3], "active": row[4]} for row in cur.fetchall()}

    # ── Find which players have real stat sources (not just eafc) ──
    cur.execute("""
        SELECT DISTINCT player_id
        FROM attribute_grades
        WHERE player_id = ANY(%s)
          AND source NOT IN ('eafc_inferred', 'computed')
    """, (pids,))
    has_real_stats = {row[0] for row in cur.fetchall()}

    # ── Compute skillsets ──
    print("\nComputing skillsets...")
    updates = []
    skipped_real_stats = 0
    skipped_no_profile = 0
    skipped_gk = 0
    unchanged = 0

    for player in graded:
        pid = player["person_id"]
        profile = profiles.get(pid)

        if not profile:
            skipped_no_profile += 1
            continue

        # Skip GKs — Airtable doesn't have GK-specific attrs (agility, footwork, handling)
        if profile["position"] == "GK":
            skipped_gk += 1
            continue

        # Only override if player lacks real stat data
        if pid in has_real_stats:
            skipped_real_stats += 1
            continue

        position = profile["position"]
        model_scores = score_models(player["grades"], position)
        skillset = best_model(model_scores)

        if not skillset:
            continue

        if skillset == profile["archetype"]:
            unchanged += 1
            continue

        updates.append({
            "person_id": pid,
            "name": player["name"],
            "position": position,
            "old": profile["archetype"],
            "new": skillset,
            "active": profile["active"],
            "scores": model_scores,
        })

    # ── Report ──
    active_updates = [u for u in updates if u["active"]]
    retired_updates = [u for u in updates if not u["active"]]

    print(f"\n  Skipped (has real stats): {skipped_real_stats}")
    print(f"  Skipped (GK):            {skipped_gk}")
    print(f"  Skipped (no profile):    {skipped_no_profile}")
    print(f"  Unchanged:               {unchanged}")
    print(f"  Updates (active):        {len(active_updates)}")
    print(f"  Updates (retired):       {len(retired_updates)}")
    print(f"  Total updates:           {len(updates)}")

    if updates:
        print(f"\n  Sample changes:")
        for u in updates[:20]:
            status = "active" if u["active"] else "retired"
            top3 = sorted(u["scores"].items(), key=lambda x: -x[1])[:3]
            top3_str = ", ".join(f"{m}={s:.0f}" for m, s in top3)
            print(f"    {u['name']:30s} ({u['position'] or '?':2s}, {status:7s}) {u['old'] or 'NULL':25s} → {u['new']:25s}  [{top3_str}]")
        if len(updates) > 20:
            print(f"    ... and {len(updates) - 20} more")

    # ── Write ──
    if args.dry_run:
        print("\n  [DRY RUN] No changes written.")
    elif updates:
        print(f"\n  Writing {len(updates)} skillset updates...")
        for u in updates:
            cur.execute("""
                UPDATE player_profiles
                SET archetype = %s
                WHERE person_id = %s
            """, (u["new"], u["person_id"]))
        conn.commit()
        print("  Done.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
