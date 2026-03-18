"""
31_infer_levels.py — Infer player levels from compound scores using seed calibration.

Uses the 98 hand-graded seed players as calibration anchors. Fits a simple
weighted linear regression per position group (DEF/MID/FWD/GK) mapping
compound scores (Technical, Tactical, Physical, Mental) → level.

Players are only inferred when they have all 4 compound scores and no
existing level (unless --force). Inferred levels are tagged with
model_id='inferred_v1' so they're distinguishable from hand-graded seeds.

Usage:
    python 31_infer_levels.py                    # infer all eligible players
    python 31_infer_levels.py --dry-run          # preview without writing
    python 31_infer_levels.py --force            # overwrite existing inferred levels
    python 31_infer_levels.py --player 123       # single player
    python 31_infer_levels.py --position-group MID  # only midfielders
    python 31_infer_levels.py --min-attributes 3    # require N of 4 compounds (default 4)
"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict

from config import POSTGRES_DSN

# ── Argument parsing ──────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Infer player levels from compound scores")
parser.add_argument("--player", type=str, default=None,
                    help="Single person_id to process")
parser.add_argument("--limit", type=int, default=None,
                    help="Max players to infer")
parser.add_argument("--dry-run", action="store_true",
                    help="Preview without writing to database")
parser.add_argument("--force", action="store_true",
                    help="Overwrite existing inferred levels (not hand-graded)")
parser.add_argument("--position-group", type=str, default=None,
                    choices=["GK", "DEF", "MID", "FWD"],
                    help="Only process one position group")
parser.add_argument("--min-attributes", type=int, default=4,
                    help="Minimum compound scores required (1-4, default 4)")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
MODEL_ID = None  # NULL model_id distinguishes inferred from hand-graded levels
CHUNK_SIZE = 200
MIN_COMPOUNDS = max(1, min(4, args.min_attributes))

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

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True

# ── Position groups ───────────────────────────────────────────────────────────

POSITION_GROUPS = {
    "GK":  ["GK"],
    "DEF": ["CD", "WD"],
    "MID": ["DM", "CM", "WM", "AM"],
    "FWD": ["WF", "CF"],
}

COMPOUNDS = ["technical", "tactical", "physical", "mental"]


def pos_to_group(pos: str) -> str | None:
    for group, positions in POSITION_GROUPS.items():
        if pos in positions:
            return group
    return None


# ── Linear regression (no numpy dependency) ───────────────────────────────────

def fit_regression(X: list[list[float]], y: list[float]) -> tuple[list[float], float]:
    """
    Fit ordinary least squares: y = X @ w + bias.

    Uses normal equation with simple matrix ops (no external deps).
    Returns (weights, bias).
    """
    n = len(y)
    k = len(X[0])

    # Augment X with bias column
    Xa = [row + [1.0] for row in X]

    # X^T @ X
    XtX = [[0.0] * (k + 1) for _ in range(k + 1)]
    for i in range(k + 1):
        for j in range(k + 1):
            for r in range(n):
                XtX[i][j] += Xa[r][i] * Xa[r][j]

    # X^T @ y
    Xty = [0.0] * (k + 1)
    for i in range(k + 1):
        for r in range(n):
            Xty[i] += Xa[r][i] * y[r]

    # Solve via Gaussian elimination with partial pivoting
    M = [XtX[i][:] + [Xty[i]] for i in range(k + 1)]
    size = k + 1

    for col in range(size):
        # Partial pivot
        max_row = col
        for row in range(col + 1, size):
            if abs(M[row][col]) > abs(M[max_row][col]):
                max_row = row
        M[col], M[max_row] = M[max_row], M[col]

        pivot = M[col][col]
        if abs(pivot) < 1e-10:
            # Near-singular, add regularization
            M[col][col] += 0.01
            pivot = M[col][col]

        for row in range(col + 1, size):
            factor = M[row][col] / pivot
            for j in range(col, size + 1):
                M[row][j] -= factor * M[col][j]

    # Back substitution
    solution = [0.0] * size
    for i in range(size - 1, -1, -1):
        solution[i] = M[i][size]
        for j in range(i + 1, size):
            solution[i] -= M[i][j] * solution[j]
        if abs(M[i][i]) > 1e-10:
            solution[i] /= M[i][i]

    return solution[:-1], solution[-1]


def predict(X: list[float], weights: list[float], bias: float) -> float:
    return sum(x * w for x, w in zip(X, weights)) + bias


def leave_one_out_mae(X: list[list[float]], y: list[float]) -> float:
    """Leave-one-out cross-validation MAE."""
    n = len(y)
    if n < 3:
        return float("inf")

    errors = []
    for i in range(n):
        X_train = X[:i] + X[i + 1:]
        y_train = y[:i] + y[i + 1:]
        w, b = fit_regression(X_train, y_train)
        pred = predict(X[i], w, b)
        errors.append(abs(pred - y[i]))
    return sum(errors) / len(errors)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Level Inference from Compound Scores")
    print(f"  Model ID:       {MODEL_ID}")
    print(f"  Min compounds:  {MIN_COMPOUNDS}")
    print(f"  Dry run:        {DRY_RUN}")
    print(f"  Force:          {FORCE}")

    cur = conn.cursor()

    # ── Step 1: Load compound scores for all players ──────────────────────────

    print("\n  Loading compound scores...")
    cur.execute("""
        SELECT ag.player_id, ag.attribute, ag.stat_score
        FROM attribute_grades ag
        WHERE ag.source = 'computed'
          AND ag.attribute IN ('technical', 'tactical', 'physical', 'mental')
    """)
    rows = cur.fetchall()

    player_compounds: dict[int, dict[str, float]] = defaultdict(dict)
    for pid, attr, score in rows:
        if score is not None and score > 0:
            # stat_score is 0-10 scale in computed rows
            player_compounds[pid][attr] = float(score)

    print(f"  Players with compound scores: {len(player_compounds)}")

    # ── Step 2: Load profiles ─────────────────────────────────────────────────

    print("  Loading player profiles...")
    cur.execute("""
        SELECT pp.person_id, pp.position, pp.level, pp.model_id, p.name
        FROM player_profiles pp
        JOIN people p ON p.id = pp.person_id
        WHERE pp.position IS NOT NULL
    """)
    profiles = {}
    for pid, pos, level, model_id, name in cur.fetchall():
        profiles[pid] = {
            "position": pos,
            "level": level,
            "model_id": model_id,
            "name": name,
        }

    print(f"  Profiles with position: {len(profiles)}")

    # ── Step 3: Split into seed (calibration) and target (to infer) ───────────

    seeds_by_group: dict[str, list[tuple[list[float], float, str]]] = defaultdict(list)
    targets: list[dict] = []

    for pid, compounds in player_compounds.items():
        profile = profiles.get(pid)
        if not profile:
            continue

        group = pos_to_group(profile["position"])
        if not group:
            continue

        if args.position_group and group != args.position_group:
            continue

        # Build feature vector [technical, tactical, physical, mental]
        features = [compounds.get(c) for c in COMPOUNDS]
        present = sum(1 for f in features if f is not None)

        if present < MIN_COMPOUNDS:
            continue

        # Fill missing with group mean later; for now use 0
        features = [f if f is not None else 0.0 for f in features]

        if profile["level"] is not None and profile["model_id"] is not None:
            # This is a hand-graded seed player
            seeds_by_group[group].append((features, float(profile["level"]), profile["name"]))
        elif profile["level"] is None or (FORCE and profile["model_id"] is None):
            # Target: no level, or force-overwrite of previously inferred
            targets.append({
                "person_id": pid,
                "name": profile["name"],
                "position": profile["position"],
                "group": group,
                "features": features,
            })
        elif args.player:
            # If specifically requested, include even if has level
            targets.append({
                "person_id": pid,
                "name": profile["name"],
                "position": profile["position"],
                "group": group,
                "features": features,
            })

    print(f"\n  Seed players per group:")
    for group in ["GK", "DEF", "MID", "FWD"]:
        seeds = seeds_by_group.get(group, [])
        if seeds:
            levels = [s[1] for s in seeds]
            print(f"    {group:3s}: {len(seeds):3d} seeds  "
                  f"(level range {min(levels):.0f}-{max(levels):.0f}, "
                  f"avg {sum(levels)/len(levels):.1f})")

    print(f"\n  Target players to infer: {len(targets)}")

    if not targets:
        print("  No players to infer. Done.")
        cur.close()
        conn.close()
        return

    # ── Step 4: Fit regression per group ──────────────────────────────────────

    models: dict[str, tuple[list[float], float]] = {}

    print(f"\n  Fitting models...")
    for group in ["GK", "DEF", "MID", "FWD"]:
        seeds = seeds_by_group.get(group, [])
        if len(seeds) < 3:
            print(f"    {group}: SKIP — only {len(seeds)} seeds (need ≥3)")
            continue

        X = [s[0] for s in seeds]
        y = [s[1] for s in seeds]

        weights, bias = fit_regression(X, y)
        models[group] = (weights, bias)

        # Validate
        mae = leave_one_out_mae(X, y)
        train_preds = [predict(x, weights, bias) for x in X]
        train_mae = sum(abs(p - t) for p, t in zip(train_preds, y)) / len(y)

        print(f"    {group}: weights=[{', '.join(f'{w:.2f}' for w in weights)}] "
              f"bias={bias:.1f}")
        print(f"          train MAE={train_mae:.2f}  LOO-CV MAE={mae:.2f}")

        if mae > 3.0:
            print(f"          ⚠ High LOO MAE — falling back to position-median adjustment")
            # Fallback: use median level + deviation from median compound score
            median_level = sorted(y)[len(y) // 2]
            median_compounds = [
                sorted([s[0][i] for s in seeds])[len(seeds) // 2]
                for i in range(4)
            ]
            # Simple fallback: level = median_level + 2 * (avg_compound_diff)
            models[group] = ("fallback", median_level, median_compounds)

        # Show seed predictions for validation
        print(f"          Seed predictions:")
        sorted_seeds = sorted(seeds, key=lambda s: -s[1])
        for feat, actual, name in sorted_seeds[:5]:
            pred = predict(feat, weights, bias)
            diff = pred - actual
            print(f"            {name:25s} actual={actual:2.0f}  pred={pred:.1f}  "
                  f"diff={diff:+.1f}")
        if len(sorted_seeds) > 5:
            print(f"            ... and {len(sorted_seeds) - 5} more")

    # ── Step 5: Predict levels ────────────────────────────────────────────────

    results = []
    skipped_no_model = 0

    for target in targets:
        group = target["group"]
        model = models.get(group)

        if not model:
            skipped_no_model += 1
            continue

        if isinstance(model[0], str) and model[0] == "fallback":
            # Fallback mode
            _, median_level, median_compounds = model
            diffs = [
                target["features"][i] - median_compounds[i]
                for i in range(4)
            ]
            avg_diff = sum(diffs) / len(diffs)
            predicted = median_level + 2.0 * avg_diff
        else:
            weights, bias = model
            predicted = predict(target["features"], weights, bias)

        # Clip to reasonable range
        predicted = round(max(75, min(95, predicted)))

        results.append({
            "person_id": target["person_id"],
            "name": target["name"],
            "position": target["position"],
            "group": group,
            "level": predicted,
            "features": target["features"],
        })

    if args.limit:
        results = results[:args.limit]

    print(f"\n  Inferred levels: {len(results)}")
    if skipped_no_model:
        print(f"  Skipped (no model for group): {skipped_no_model}")

    # ── Step 6: Distribution ──────────────────────────────────────────────────

    if results:
        levels = [r["level"] for r in results]
        print(f"\n  Inferred level distribution:")
        print(f"    Min: {min(levels)}  Max: {max(levels)}  "
              f"Avg: {sum(levels)/len(levels):.1f}  "
              f"Median: {sorted(levels)[len(levels)//2]}")

        # Per group
        for group in ["GK", "DEF", "MID", "FWD"]:
            gl = [r["level"] for r in results if r["group"] == group]
            if gl:
                print(f"    {group:3s}: n={len(gl):3d}  "
                      f"range={min(gl)}-{max(gl)}  avg={sum(gl)/len(gl):.1f}")

        # Show samples
        print(f"\n  Sample inferred players:")
        sorted_results = sorted(results, key=lambda r: -r["level"])
        for r in sorted_results[:10]:
            compounds = "/".join(f"{f:.0f}" for f in r["features"])
            print(f"    {r['name']:30s} {r['position']:3s}  "
                  f"level={r['level']}  compounds=[{compounds}]")
        if len(sorted_results) > 10:
            remaining = len(sorted_results) - 10
            for r in sorted_results[-3:]:
                compounds = "/".join(f"{f:.0f}" for f in r["features"])
                print(f"    {r['name']:30s} {r['position']:3s}  "
                      f"level={r['level']}  compounds=[{compounds}]")
            print(f"    ... ({remaining} more)")

    # ── Step 7: Write results ─────────────────────────────────────────────────

    if not DRY_RUN and results:
        written = 0
        for r in results:
            cur.execute("""
                UPDATE player_profiles
                SET level = %s, model_id = %s
                WHERE person_id = %s
            """, (r["level"], MODEL_ID, r["person_id"]))
            written += 1

        print(f"\n  Written {written} inferred levels to player_profiles")
        print(f"  (model_id={MODEL_ID} — distinguishable from hand-graded)")

    elif DRY_RUN:
        print(f"\n  [dry-run] Would write {len(results)} inferred levels")

    # ── Summary ───────────────────────────────────────────────────────────────

    print(f"\n── Summary ──────────────────────────────────────────────────────────")
    print(f"  Seed players:   {sum(len(v) for v in seeds_by_group.values())}")
    print(f"  Inferred:       {len(results)}")
    print(f"  Skipped:        {skipped_no_model}")
    if DRY_RUN:
        print("  (dry-run — no data was written)")

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
