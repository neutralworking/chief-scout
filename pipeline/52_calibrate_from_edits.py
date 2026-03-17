#!/usr/bin/env python3
"""
Pipeline 52 — Calibrate from Manual Edits

Reads manual level corrections from network_edits and uses them to:
1. Detect systematic source bias (which data sources over/under-rate players)
2. Predict corrected levels for uncorrected players via regression
3. Apply predicted corrections (with --apply flag)

Usage:
  python pipeline/52_calibrate_from_edits.py                    # analyze only
  python pipeline/52_calibrate_from_edits.py --apply            # apply predicted corrections
  python pipeline/52_calibrate_from_edits.py --apply --limit 50 # apply top 50 corrections
  python pipeline/52_calibrate_from_edits.py --dry-run          # show what would change
"""

import argparse
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone

import dotenv

dotenv.load_dotenv(".env.local")
dotenv.load_dotenv("apps/web/.env.local")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    sys.exit(1)

from supabase import create_client

sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_level_edits():
    """Fetch all manual level corrections from network_edits."""
    res = sb.table("network_edits").select("*").eq("field", "level").eq("table_name", "player_profiles").execute()
    edits = []
    for row in res.data:
        try:
            old_val = float(row["old_value"]) if row.get("old_value") else None
            new_val = float(row["new_value"]) if row.get("new_value") else None
            if old_val is not None and new_val is not None and old_val != new_val:
                edits.append({
                    "person_id": row["person_id"],
                    "old_level": old_val,
                    "new_level": new_val,
                    "delta": new_val - old_val,
                    "created_at": row.get("created_at"),
                })
        except (ValueError, TypeError):
            continue
    return edits


def fetch_player_sources(person_ids):
    """For each player, get which data sources they have grades from."""
    player_sources = defaultdict(lambda: defaultdict(int))
    for i in range(0, len(person_ids), 50):
        chunk = person_ids[i:i + 50]
        res = sb.table("attribute_grades").select("player_id, source").in_("player_id", chunk).neq("source", "computed").execute()
        for row in res.data:
            player_sources[row["player_id"]][row["source"]] += 1
    return player_sources


def fetch_player_grades(person_ids):
    """Fetch attribute grades for players (for regression features)."""
    player_grades = defaultdict(dict)
    for i in range(0, len(person_ids), 50):
        chunk = person_ids[i:i + 50]
        res = sb.table("attribute_grades").select(
            "player_id, attribute, scout_grade, stat_score, source"
        ).in_("player_id", chunk).neq("source", "computed").execute()
        for row in res.data:
            attr = row["attribute"].lower().replace(" ", "_")
            # Use best available score, normalized to 0-20
            score = None
            if row.get("scout_grade") and row["scout_grade"] > 0:
                score = min(row["scout_grade"], 20)
            elif row.get("stat_score") and row["stat_score"] > 0:
                if row["source"] in ("statsbomb", "eafc_inferred"):
                    score = min(row["stat_score"], 20)
                elif row["source"] == "understat":
                    score = min(row["stat_score"] * 1.7, 17)
                else:
                    score = min(row["stat_score"] * 2, 20)
            if score is not None:
                existing = player_grades[row["player_id"]].get(attr)
                if existing is None or score > existing:
                    player_grades[row["player_id"]][attr] = score
    return player_grades


def fetch_all_profiles():
    """Fetch all player profiles with level data."""
    profiles = {}
    res = sb.table("player_profiles").select("person_id, position, level, peak, overall").not_.is_("level", "null").execute()
    for row in res.data:
        profiles[row["person_id"]] = row
    return profiles


# ── Phase 1: Source Bias Detection ────────────────────────────────────────────

def analyze_source_bias(edits, player_sources):
    """Detect which data sources correlate with over/under-rating."""
    source_deltas = defaultdict(list)

    for edit in edits:
        pid = edit["person_id"]
        sources = player_sources.get(pid, {})
        for source, count in sources.items():
            source_deltas[source].append(edit["delta"])

    print("\n── Source Bias Analysis ─────────────────────────────────────────")
    print(f"  Based on {len(edits)} manual corrections\n")

    bias_factors = {}
    for source, deltas in sorted(source_deltas.items(), key=lambda x: len(x[1]), reverse=True):
        avg_delta = sum(deltas) / len(deltas)
        bias_factors[source] = avg_delta
        direction = "over-rates" if avg_delta < 0 else "under-rates"
        print(f"  {source:20s}  n={len(deltas):3d}  avg Δ={avg_delta:+.1f}  ({direction} by {abs(avg_delta):.1f})")

    return bias_factors


# ── Phase 2: Level Prediction ─────────────────────────────────────────────────

# Key attributes that correlate with player quality
FEATURE_ATTRS = [
    "pace", "shooting", "passing", "dribbling", "defending", "physical",
    "acceleration", "sprint_speed", "finishing", "long_shots", "positioning",
    "vision", "short_passing", "long_passing", "crossing", "ball_control",
    "agility", "balance", "stamina", "strength", "aggression",
    "interceptions", "heading", "marking", "tackling", "composure",
    "reactions", "awareness", "creativity", "through_balls", "first_touch",
    "skills", "take_ons", "pass_accuracy", "pass_range", "discipline",
    "work_rate", "carries", "aerial",
]


def build_feature_vector(grades):
    """Build a fixed-size feature vector from player grades."""
    vec = []
    for attr in FEATURE_ATTRS:
        vec.append(grades.get(attr, 0))
    # Add aggregate stats
    values = [v for v in grades.values() if v > 0]
    vec.append(sum(values) / len(values) if values else 0)  # mean grade
    vec.append(max(values) if values else 0)  # max grade
    vec.append(len(values))  # grade count
    return vec


def predict_levels(edits, player_grades, profiles, bias_factors):
    """
    Simple regression: use corrected players as training data to predict
    what uncorrected players' levels should be.

    Uses a k-nearest-neighbors approach based on attribute similarity.
    """
    # Build training set from corrections
    training = []
    for edit in edits:
        pid = edit["person_id"]
        if pid not in player_grades:
            continue
        vec = build_feature_vector(player_grades[pid])
        training.append({
            "person_id": pid,
            "features": vec,
            "corrected_level": edit["new_level"],
            "old_level": edit["old_level"],
            "position": profiles.get(pid, {}).get("position"),
        })

    if len(training) < 5:
        print(f"\n  Too few training samples ({len(training)}) for prediction. Need 5+ corrections.")
        return []

    print(f"\n── Level Prediction ────────────────────────────────────────────")
    print(f"  Training on {len(training)} corrected players")

    # For each uncorrected player, find k nearest corrected players and
    # compute predicted level adjustment
    corrected_ids = {e["person_id"] for e in edits}
    predictions = []

    for pid, profile in profiles.items():
        if pid in corrected_ids:
            continue
        if pid not in player_grades:
            continue

        current_level = profile.get("level")
        current_overall = profile.get("overall")
        pos = profile.get("position")
        if not current_level:
            continue

        vec = build_feature_vector(player_grades[pid])

        # Find nearest neighbors (same position preferred)
        distances = []
        for t in training:
            # Euclidean distance on feature vectors
            dist = sum((a - b) ** 2 for a, b in zip(vec, t["features"])) ** 0.5
            # Position penalty: different position = +50% distance
            if pos and t["position"] and pos != t["position"]:
                dist *= 1.5
            distances.append((dist, t))

        distances.sort(key=lambda x: x[0])
        k = min(5, len(distances))
        neighbors = distances[:k]

        if not neighbors:
            continue

        # Weighted average of corrections (closer neighbors have more weight)
        total_weight = 0
        weighted_delta = 0
        for dist, t in neighbors:
            w = 1 / (dist + 1)  # inverse distance weight
            # Scale the neighbor's correction proportionally
            # If neighbor went from 86→72, that's a -14 delta
            # But only apply a portion based on similarity of current level
            level_ratio = current_level / t["old_level"] if t["old_level"] else 1
            neighbor_delta = t["corrected_level"] - t["old_level"]
            adjusted_delta = neighbor_delta * level_ratio
            weighted_delta += adjusted_delta * w
            total_weight += w

        if total_weight <= 0:
            continue

        predicted_delta = weighted_delta / total_weight

        # Also apply source bias
        sources = player_grades.get(pid, {})
        # Can't easily separate source here, but we can use overall bias
        source_adjustment = 0
        player_source_res = sb.table("attribute_grades").select("source").eq("player_id", pid).neq("source", "computed").execute()
        player_source_set = set(r["source"] for r in player_source_res.data)
        for src in player_source_set:
            if src in bias_factors:
                source_adjustment += bias_factors[src]
        if player_source_set:
            source_adjustment /= len(player_source_set)

        # Combine: 70% kNN prediction, 30% source bias
        combined_delta = predicted_delta * 0.7 + source_adjustment * 0.3

        # Only flag if the change is meaningful (>= 2 levels)
        if abs(combined_delta) < 2:
            continue

        predicted_level = round(current_level + combined_delta)
        predicted_level = max(30, min(99, predicted_level))

        predictions.append({
            "person_id": pid,
            "current_level": current_level,
            "predicted_level": predicted_level,
            "delta": round(combined_delta, 1),
            "overall": current_overall,
            "position": pos,
            "confidence": min(1.0, k / 5),  # higher with more neighbors
        })

    # Sort by absolute delta (biggest mismatches first)
    predictions.sort(key=lambda x: abs(x["delta"]), reverse=True)

    return predictions


# ── Phase 3: Apply Predictions ────────────────────────────────────────────────

def apply_predictions(predictions, dry_run=False, limit=None):
    """Write predicted level corrections to player_profiles."""
    if limit:
        predictions = predictions[:limit]

    print(f"\n── Applying Predictions {'(DRY RUN) ' if dry_run else ''}──────────────────────────────")

    # Fetch names
    pids = [p["person_id"] for p in predictions]
    names = {}
    for i in range(0, len(pids), 50):
        res = sb.table("people").select("id, name").in_("id", pids[i:i + 50]).execute()
        for r in res.data:
            names[r["id"]] = r["name"]

    applied = 0
    for pred in predictions:
        pid = pred["person_id"]
        name = names.get(pid, f"#{pid}")
        direction = "↓" if pred["delta"] < 0 else "↑"
        print(f"  {name:30s} {pred['position'] or '':3s}  "
              f"{pred['current_level']:3.0f} → {pred['predicted_level']:3.0f}  "
              f"({direction}{abs(pred['delta']):.1f})  ovr={pred['overall'] or '?'}")

        if not dry_run:
            sb.table("player_profiles").update({
                "level": pred["predicted_level"],
            }).eq("person_id", pid).execute()

            # Log as automated correction
            try:
                sb.table("network_edits").insert({
                    "person_id": pid,
                    "field": "level",
                    "old_value": str(pred["current_level"]),
                    "new_value": str(pred["predicted_level"]),
                    "table_name": "player_profiles",
                    "user_id": "calibration_52",
                }).execute()
            except Exception:
                pass

            applied += 1

    print(f"\n  {'Would apply' if dry_run else 'Applied'}: {len(predictions)} corrections")
    return applied


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Calibrate levels from manual edits")
    parser.add_argument("--apply", action="store_true", help="Apply predicted corrections")
    parser.add_argument("--dry-run", action="store_true", help="Show changes without applying")
    parser.add_argument("--limit", type=int, default=None, help="Max corrections to apply")
    parser.add_argument("--min-delta", type=float, default=3, help="Minimum level change to flag (default: 3)")
    args = parser.parse_args()

    print("═" * 60)
    print("  Pipeline 52 — Calibrate from Manual Edits")
    print("═" * 60)

    # Fetch manual corrections
    edits = fetch_level_edits()
    print(f"\n  Found {len(edits)} manual level corrections in network_edits")

    if not edits:
        print("\n  No corrections found yet. Make some level edits on /players first.")
        print("  Each edit you make becomes training data for this pipeline.")
        return

    # Show correction summary
    avg_delta = sum(e["delta"] for e in edits) / len(edits)
    down = sum(1 for e in edits if e["delta"] < 0)
    up = sum(1 for e in edits if e["delta"] > 0)
    print(f"  Average correction: {avg_delta:+.1f}  ({down} down, {up} up)")

    # Fetch supporting data
    corrected_ids = list(set(e["person_id"] for e in edits))
    print(f"\n  Fetching data for {len(corrected_ids)} corrected players...")
    player_sources = fetch_player_sources(corrected_ids)

    # Phase 1: Source bias
    bias_factors = analyze_source_bias(edits, player_sources)

    # Phase 2: Predict levels
    print("\n  Fetching profiles and grades for prediction...")
    profiles = fetch_all_profiles()
    all_pids = list(profiles.keys())
    player_grades = fetch_player_grades(all_pids)
    print(f"  {len(profiles)} profiles, {len(player_grades)} with grades")

    predictions = predict_levels(edits, player_grades, profiles, bias_factors)

    # Filter by minimum delta
    predictions = [p for p in predictions if abs(p["delta"]) >= args.min_delta]

    if predictions:
        print(f"\n  Found {len(predictions)} players with predicted Δ >= {args.min_delta}")

        # Show top 20
        print(f"\n  Top 20 predicted corrections:")
        pids_preview = [p["person_id"] for p in predictions[:20]]
        names_preview = {}
        for i in range(0, len(pids_preview), 50):
            res = sb.table("people").select("id, name").in_("id", pids_preview[i:i + 50]).execute()
            for r in res.data:
                names_preview[r["id"]] = r["name"]

        for pred in predictions[:20]:
            name = names_preview.get(pred["person_id"], f"#{pred['person_id']}")
            direction = "↓" if pred["delta"] < 0 else "↑"
            print(f"    {name:30s} {pred['position'] or '':3s}  "
                  f"lvl={pred['current_level']:3.0f} → {pred['predicted_level']:3.0f}  "
                  f"({direction}{abs(pred['delta']):.1f})  ovr={pred['overall'] or '?'}")

        # Apply if requested
        if args.apply or args.dry_run:
            apply_predictions(predictions, dry_run=args.dry_run, limit=args.limit)
    else:
        print(f"\n  No players found with predicted Δ >= {args.min_delta}")
        print("  Make more corrections on /players to improve predictions.")

    # Summary
    print(f"\n── Summary ─────────────────────────────────────────────────────")
    print(f"  Manual corrections analyzed: {len(edits)}")
    print(f"  Source biases detected:      {len(bias_factors)}")
    print(f"  Predicted corrections:       {len(predictions)}")
    if not args.apply and not args.dry_run and predictions:
        print(f"\n  Run with --dry-run to preview, or --apply to write corrections.")

    print("\nDone.")


if __name__ == "__main__":
    main()
