"""
27_player_ratings.py — Compute composite player ratings from multi-source data.

Combines:
  - attribute_grades (fbref, statsbomb, understat, eafc_inferred, scout_assessment)
  - 13 playing models → 4 compound scores (Technical, Tactical, Physical, Mental)
  - career_metrics (trajectory, loyalty)
  - news_sentiment_agg (buzz, sentiment)
  - player_profiles (existing level, peak)

Outputs:
  - Updates player_profiles.overall with computed technical rating
  - Writes per-model scores to attribute_grades with source='computed'

Usage:
    python 27_player_ratings.py                    # all players with attribute data
    python 27_player_ratings.py --player 123       # single player
    python 27_player_ratings.py --limit 100        # first 100 players
    python 27_player_ratings.py --dry-run           # preview without writing
    python 27_player_ratings.py --force             # overwrite existing ratings
"""
import argparse
import math
import sys
from datetime import datetime, timezone

from supabase import create_client

from config import POSTGRES_DSN, SUPABASE_URL, SUPABASE_SERVICE_KEY

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Compute composite player ratings")
parser.add_argument("--player", type=str, default=None,
                    help="Single person_id to process")
parser.add_argument("--limit", type=int, default=None,
                    help="Max players to process")
parser.add_argument("--dry-run", action="store_true",
                    help="Print summaries without writing to database")
parser.add_argument("--force", action="store_true",
                    help="Overwrite existing ratings")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
CHUNK_SIZE = 200

# ── Connections ────────────────────────────────────────────────────────────────

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env")
    sys.exit(1)
if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
sb_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ── Model Definitions (matches radar route.ts) ───────────────────────────────

MODEL_ATTRIBUTES = {
    "Controller":  ["anticipation", "composure", "decisions", "tempo"],
    "Commander":   ["communication", "concentration", "drive", "leadership"],
    "Creator":     ["creativity", "unpredictability", "vision", "guile"],
    "Target":      ["aerial_duels", "heading", "jumping", "volleys"],
    "Sprinter":    ["acceleration", "balance", "movement", "pace"],
    "Powerhouse":  ["aggression", "duels", "shielding", "stamina"],
    "Cover":       ["awareness", "discipline", "interceptions", "positioning"],
    "Engine":      ["intensity", "pressing", "stamina", "versatility"],
    "Destroyer":   ["blocking", "clearances", "marking", "tackling"],
    "Dribbler":    ["carries", "first_touch", "skills", "take_ons"],
    "Passer":      ["pass_accuracy", "crossing", "pass_range", "through_balls"],
    "Striker":     ["close_range", "mid_range", "long_range", "penalties"],
    "GK":          ["agility", "footwork", "handling", "reactions"],
}

# 4 compound groupings
COMPOUND_MODELS = {
    "Technical": ["Dribbler", "Passer", "Striker", "GK"],
    "Tactical":  ["Cover", "Destroyer", "Engine"],
    "Physical":  ["Sprinter", "Powerhouse", "Target"],
    "Mental":    ["Controller", "Commander", "Creator"],
}

# Position weights for overall calculation (which compounds matter per position)
POSITION_COMPOUND_WEIGHTS = {
    "GK":  {"Technical": 0.5, "Tactical": 0.2, "Physical": 0.1, "Mental": 0.2},
    "CD":  {"Technical": 0.1, "Tactical": 0.4, "Physical": 0.3, "Mental": 0.2},
    "WD":  {"Technical": 0.2, "Tactical": 0.3, "Physical": 0.3, "Mental": 0.2},
    "DM":  {"Technical": 0.2, "Tactical": 0.4, "Physical": 0.2, "Mental": 0.2},
    "CM":  {"Technical": 0.3, "Tactical": 0.2, "Physical": 0.2, "Mental": 0.3},
    "WM":  {"Technical": 0.3, "Tactical": 0.2, "Physical": 0.3, "Mental": 0.2},
    "AM":  {"Technical": 0.4, "Tactical": 0.1, "Physical": 0.2, "Mental": 0.3},
    "WF":  {"Technical": 0.3, "Tactical": 0.1, "Physical": 0.3, "Mental": 0.3},
    "CF":  {"Technical": 0.3, "Tactical": 0.1, "Physical": 0.3, "Mental": 0.3},
}

# Source priority (higher = preferred)
SOURCE_PRIORITY = {
    "scout_assessment": 5,
    "fbref": 4,
    "statsbomb": 3,
    "understat": 2,
    "computed": 1,
    "eafc_inferred": 0,
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _safe(val):
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val


def compute_model_scores(grades):
    """Compute model scores (0-100) from best-source attribute grades (0-20 scale)."""
    # Build best-grade-per-attribute map (prefer highest-priority source)
    best = {}  # attr -> (score, priority)
    for g in grades:
        attr = g["attribute"].lower().replace(" ", "_")
        score = g["scout_grade"] if g["scout_grade"] is not None else g.get("stat_score")
        if score is None or score <= 0:
            continue
        priority = SOURCE_PRIORITY.get(g.get("source", ""), 0)
        existing = best.get(attr)
        if existing is None or priority > existing[1]:
            best[attr] = (score, priority)

    # Compute each model score
    model_scores = {}
    for model, attrs in MODEL_ATTRIBUTES.items():
        values = [best[a][0] for a in attrs if a in best]
        if values:
            avg = sum(values) / len(values)
            # Convert from 0-20 to 0-100
            model_scores[model] = round(min(avg * 5, 100))

    return model_scores


def compute_compound_scores(model_scores):
    """Compute compound scores from model scores."""
    compounds = {}
    for compound, models in COMPOUND_MODELS.items():
        values = [model_scores[m] for m in models if m in model_scores]
        if values:
            compounds[compound] = round(sum(values) / len(values))
    return compounds


def compute_overall(compound_scores, position, level=None, peak=None):
    """
    Compute overall rating as a position-weighted compound average.

    The overall blends:
    - 70% technical compound score (position-weighted attribute average)
    - 15% level (editorial assessment, if available)
    - 15% peak (career ceiling, if available)

    If level/peak unavailable, 100% from compound scores.
    """
    weights = POSITION_COMPOUND_WEIGHTS.get(position, {
        "Technical": 0.25, "Tactical": 0.25, "Physical": 0.25, "Mental": 0.25,
    })

    weighted_sum = 0
    total_weight = 0
    for compound, weight in weights.items():
        if compound in compound_scores:
            weighted_sum += compound_scores[compound] * weight
            total_weight += weight

    if total_weight <= 0:
        return None

    technical_overall = weighted_sum / total_weight

    # Blend with level/peak if available
    if level is not None and peak is not None:
        # Level and peak are on ~0-100 scale
        editorial = (level * 0.6 + peak * 0.4)
        overall = technical_overall * 0.7 + editorial * 0.3
    elif level is not None:
        overall = technical_overall * 0.75 + level * 0.25
    else:
        overall = technical_overall

    return round(min(max(overall, 1), 99))


def has_differentiated_data(model_scores):
    """Check if data has real variation (not all flat eafc defaults)."""
    values = list(model_scores.values())
    if len(values) < 3:
        return False
    return len(set(values)) > 2


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Player Rating Calculator")
    print(f"  Dry run: {DRY_RUN}")
    print(f"  Force:   {FORCE}")

    cur = conn.cursor()

    # ── Step 1: Fetch all attribute grades ────────────────────────────────────

    where_clauses = []
    params = []

    if args.player:
        where_clauses.append("ag.player_id = %s")
        params.append(int(args.player))

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    print("\n  Loading attribute grades...")
    cur.execute(f"""
        SELECT ag.player_id, ag.attribute, ag.scout_grade, ag.stat_score, ag.source
        FROM attribute_grades ag
        {where_sql}
        ORDER BY ag.player_id
    """, params)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]

    if not rows:
        print("  No attribute grades found.")
        cur.close()
        conn.close()
        return

    # Group by player
    player_grades = {}
    for row in rows:
        d = dict(zip(cols, row))
        pid = d["player_id"]
        player_grades.setdefault(pid, []).append(d)

    print(f"  Players with attribute data: {len(player_grades)}")

    # ── Step 2: Fetch existing profiles (level, peak, position) ──────────────

    print("  Loading player profiles...")
    cur.execute("""
        SELECT person_id, position, level, peak, overall
        FROM player_profiles
        WHERE position IS NOT NULL
    """)
    profiles = {}
    for row in cur.fetchall():
        profiles[row[0]] = {
            "position": row[1],
            "level": row[2],
            "peak": row[3],
            "old_overall": row[4],
        }
    print(f"  Profiles with position: {len(profiles)}")

    # ── Step 3: Compute ratings ──────────────────────────────────────────────

    player_ids = list(player_grades.keys())
    if args.limit:
        player_ids = player_ids[:args.limit]

    results = []
    stats = {
        "computed": 0,
        "skipped_flat": 0,
        "skipped_no_position": 0,
        "updated_overall": 0,
    }
    compound_distribution = {"Technical": [], "Tactical": [], "Physical": [], "Mental": []}
    overall_distribution = []

    for pid in player_ids:
        grades = player_grades[pid]
        profile = profiles.get(pid)

        if not profile:
            stats["skipped_no_position"] += 1
            continue

        model_scores = compute_model_scores(grades)

        if not has_differentiated_data(model_scores):
            stats["skipped_flat"] += 1
            continue

        compound_scores = compute_compound_scores(model_scores)

        position = profile["position"]
        level = profile.get("level")
        peak = profile.get("peak")

        overall = compute_overall(compound_scores, position, level, peak)

        if overall is None:
            continue

        stats["computed"] += 1
        overall_distribution.append(overall)

        for comp, score in compound_scores.items():
            compound_distribution[comp].append(score)

        results.append({
            "person_id": pid,
            "overall": overall,
            "model_scores": model_scores,
            "compound_scores": compound_scores,
            "position": position,
            "level": level,
            "peak": peak,
        })

    print(f"\n  Computed ratings: {stats['computed']}")
    print(f"  Skipped (flat data): {stats['skipped_flat']}")
    print(f"  Skipped (no position): {stats['skipped_no_position']}")

    # ── Step 4: Distribution stats ───────────────────────────────────────────

    if overall_distribution:
        print(f"\n  Overall distribution:")
        print(f"    Min: {min(overall_distribution)}  Max: {max(overall_distribution)}  "
              f"Avg: {sum(overall_distribution) / len(overall_distribution):.1f}  "
              f"Median: {sorted(overall_distribution)[len(overall_distribution) // 2]}")

        for comp, vals in compound_distribution.items():
            if vals:
                print(f"    {comp:10s}  avg={sum(vals)/len(vals):.1f}  "
                      f"min={min(vals)}  max={max(vals)}  n={len(vals)}")

    # ── Step 5: Show samples ─────────────────────────────────────────────────

    if results:
        # Show top 5 by overall
        top = sorted(results, key=lambda r: -r["overall"])[:5]
        print(f"\n  Top 5 rated players:")
        for r in top:
            name_q = cur.execute("SELECT name FROM people WHERE id = %s", (r["person_id"],))
            name_row = cur.fetchone()
            name = name_row[0] if name_row else f"#{r['person_id']}"
            compounds = ", ".join(f"{k}={v}" for k, v in r["compound_scores"].items())
            level_str = f" lvl={r['level']}" if r['level'] else ""
            peak_str = f" pk={r['peak']}" if r['peak'] else ""
            print(f"    {name:25s} {r['position']:3s}  overall={r['overall']:2d}"
                  f"{level_str}{peak_str}  [{compounds}]")

    # ── Step 6: Write results ────────────────────────────────────────────────

    if not DRY_RUN and results:
        now_iso = datetime.now(timezone.utc).isoformat()

        # Update player_profiles.overall
        profile_updates = []
        for r in results:
            profile_updates.append({
                "person_id": r["person_id"],
                "overall": float(r["overall"]),
            })

        for i in range(0, len(profile_updates), CHUNK_SIZE):
            chunk = profile_updates[i:i + CHUNK_SIZE]
            sb_client.table("player_profiles").upsert(
                chunk, on_conflict="person_id"
            ).execute()
            stats["updated_overall"] += len(chunk)

        print(f"\n  Updated player_profiles.overall: {stats['updated_overall']}")

        # Write compound scores as attribute_grades (source='computed')
        # stat_score is 0-20 scale, so convert from 0-100
        compound_rows = []
        for r in results:
            for compound, score in r["compound_scores"].items():
                compound_rows.append({
                    "player_id": r["person_id"],
                    "attribute": compound.lower(),
                    "stat_score": max(1, min(20, round(score / 5))),
                    "source": "computed",
                    "is_inferred": True,
                    "updated_at": now_iso,
                })

        if compound_rows:
            for i in range(0, len(compound_rows), CHUNK_SIZE):
                chunk = compound_rows[i:i + CHUNK_SIZE]
                sb_client.table("attribute_grades").upsert(
                    chunk, on_conflict="player_id,attribute,source"
                ).execute()
            print(f"  Wrote compound scores: {len(compound_rows)} rows")

    elif DRY_RUN:
        print(f"\n  [dry-run] would update {len(results)} player_profiles.overall values")
        print(f"  [dry-run] would write {len(results) * 4} compound score rows")

    # ── Summary ──────────────────────────────────────────────────────────────

    print(f"\n── Summary ───────────────────────────────────────────────────────")
    print(f"  Players processed:   {stats['computed']}")
    print(f"  Overall ratings:     {stats.get('updated_overall', 0)} written")
    print(f"  Skipped (flat):      {stats['skipped_flat']}")
    print(f"  Skipped (no pos):    {stats['skipped_no_position']}")
    if DRY_RUN:
        print("  (dry-run — no data was written)")

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
