#!/usr/bin/env python3
"""60 — Compute role-specific percentile radar fingerprints.

For each player with a best_role, picks the 4-5 models that define that
role, computes raw model scores from attribute_grades, then ranks each
axis as a percentile within the role's player pool (role-pool) or
position group (position-pool).

Falls back to generic position-specific 4-axis radar for players
without a best_role or whose role pool is too small.

Usage:
    python 60_fingerprints.py [--dry-run] [--player NAME] [--force]
    python 60_fingerprints.py [--pool role|position|global]
"""

import argparse
import json
import sys

import numpy as np

from lib.db import require_conn
from lib.models import MODEL_ATTRIBUTES, MODEL_SHORT, ATTR_ALIASES, SOURCE_PRIORITY

# ── Attribute proxies ────────────────────────────────────────────────────────
# Mirrors apps/web/src/app/api/players/[id]/radar/route.ts ATTR_PROXIES.
# Maps model attributes with zero/sparse DB coverage to existing attributes.
ATTR_PROXIES = {
    # Commander attrs (zero data) → existing mental/tactical proxies
    "communication":    "tactical",
    "concentration":    "composure",
    "drive":            "intensity",
    "leadership":       "mental",
    # Controller attrs (sparse) → existing proxies
    "anticipation":     "awareness",
    "decisions":        "tactical",
    "tempo":            "composure",
    # GK attrs (sparse)
    "agility":          "reactions",
    "handling":         "footwork",
}

# Minimum players in a role pool before we fall back to position pool
MIN_POOL_SIZE = 30

# Role → relevant models (4-5 axes). Must match apps/web/src/lib/role-radar.ts.
ROLE_AXES = {
    # GK
    "Shotstopper":        ["GK", "Cover", "Commander", "Target"],
    "Sweeper Keeper":     ["GK", "Passer", "Controller", "Cover"],
    "Sweeper":            ["GK", "Passer", "Controller", "Cover"],
    "Libero GK":          ["GK", "Passer", "Controller", "Cover"],
    "Comandante":         ["GK", "Commander", "Cover", "Passer"],
    # CD
    "Stopper":            ["Destroyer", "Cover", "Powerhouse", "Target", "Commander"],
    "Ball-Playing CB":    ["Cover", "Passer", "Controller", "Destroyer"],
    "Enforcer":           ["Destroyer", "Commander", "Powerhouse", "Cover"],
    "Ball-Carrier":       ["Cover", "Dribbler", "Passer", "Controller"],
    "Zagueiro":           ["Destroyer", "Cover", "Commander", "Target"],
    "Stopper":         ["Destroyer", "Cover", "Powerhouse", "Engine"],
    "Libero":             ["Cover", "Passer", "Controller", "Dribbler"],
    # WD
    "Lateral":            ["Engine", "Sprinter", "Dribbler", "Cover"],
    "Fluidificante":      ["Engine", "Sprinter", "Dribbler", "Cover"],
    "Invertido":          ["Cover", "Passer", "Controller", "Engine"],
    "Corredor":           ["Engine", "Dribbler", "Sprinter", "Passer"],
    # DM
    "Anchor":         ["Cover", "Destroyer", "Controller", "Commander"],
    "Regista":            ["Controller", "Passer", "Creator", "Cover"],
    "Volante":            ["Destroyer", "Engine", "Cover", "Powerhouse"],
    "Pivote":             ["Cover", "Destroyer", "Controller", "Commander"],
    # CM
    "Metodista":          ["Controller", "Passer", "Creator", "Cover"],
    "Tuttocampista":      ["Engine", "Cover", "Destroyer", "Powerhouse", "Sprinter"],
    "Mezzala":            ["Passer", "Creator", "Dribbler", "Engine"],
    "Relayeur":           ["Passer", "Engine", "Controller", "Cover"],
    # WM
    "False Winger":       ["Dribbler", "Passer", "Creator", "Controller"],
    "Winger":             ["Sprinter", "Dribbler", "Engine", "Passer"],
    "Shuttler":           ["Sprinter", "Dribbler", "Engine", "Passer"],
    "Wide Provider":      ["Passer", "Engine", "Controller", "Dribbler"],
    "Tornante":           ["Engine", "Sprinter", "Dribbler", "Passer"],
    # AM
    "Trequartista":       ["Creator", "Dribbler", "Controller", "Striker"],
    "Seconda Punta":      ["Dribbler", "Striker", "Sprinter", "Engine"],
    "Enganche":           ["Creator", "Dribbler", "Controller", "Passer"],
    "Boxcrasher":         ["Striker", "Engine", "Powerhouse", "Dribbler"],
    # WF
    "Inside Forward":     ["Dribbler", "Sprinter", "Striker", "Creator"],
    "Extremo":            ["Sprinter", "Dribbler", "Striker", "Creator"],
    "Inventor":           ["Creator", "Dribbler", "Passer", "Sprinter"],
    "Raumdeuter":         ["Cover", "Striker", "Engine", "Sprinter"],
    # CF
    "Prima Punta":        ["Striker", "Sprinter", "Target", "Dribbler"],
    "Poacher":            ["Striker", "Sprinter", "Dribbler", "Target"],
    "Falso Nove":         ["Dribbler", "Striker", "Creator", "Controller"],
    "Deep-Lying Forward": ["Creator", "Striker", "Passer", "Engine"],
    "Spearhead":          ["Engine", "Destroyer", "Striker", "Sprinter"],
}


def compute_model_scores(grades):
    """Compute model scores (0-100) from attribute grades, with proxy fallback."""
    attr_best = {}
    for attr, sg, ss, src in grades:
        raw = sg if sg else ss if ss else 0
        if raw <= 0:
            continue
        attr = attr.lower().replace(" ", "_")
        attr = ATTR_ALIASES.get(attr, attr)
        priority = SOURCE_PRIORITY.get(src or "eafc_inferred", 1)
        scale = 20.0 if raw > 10 else 10.0
        normalized = (raw / scale) * 100
        existing = attr_best.get(attr)
        if not existing or priority > existing[1]:
            attr_best[attr] = (normalized, priority)

    attr_scores = {k: round(v[0]) for k, v in attr_best.items()}

    # Apply proxies: if a model attribute is missing, try its proxy
    for canonical, proxy in ATTR_PROXIES.items():
        if canonical not in attr_scores and proxy in attr_scores:
            attr_scores[canonical] = attr_scores[proxy]

    model_scores = {}
    for model, attrs in MODEL_ATTRIBUTES.items():
        vals = [attr_scores[a] for a in attrs if a in attr_scores]
        model_scores[model] = round(sum(vals) / len(vals)) if vals else None

    return model_scores


def role_axes(model_scores, role):
    """Extract model values for a role's specific axes.

    Missing models get neutral score (50) to keep consistent axis count
    within a role — required for percentile ranking within the pool.
    """
    models = ROLE_AXES.get(role)
    if not models:
        return None, None
    has_any = any(model_scores.get(m) is not None for m in models)
    if not has_any:
        return None, None
    values = [model_scores.get(m) if model_scores.get(m) is not None else 50 for m in models]
    return values, models


POSITION_AXES = {
    "GK": ["GK", "Commander", "Cover", "Passer"],
    "CD": ["Destroyer", "Cover", "Commander", "Passer"],
    "WD": ["Engine", "Cover", "Passer", "Sprinter"],
    "DM": ["Cover", "Destroyer", "Controller", "Engine"],
    "CM": ["Controller", "Passer", "Cover", "Engine"],
    "WM": ["Dribbler", "Sprinter", "Passer", "Engine"],
    "AM": ["Creator", "Dribbler", "Controller", "Striker"],
    "WF": ["Dribbler", "Sprinter", "Striker", "Creator"],
    "CF": ["Striker", "Target", "Dribbler", "Sprinter"],
}


def generic_axes(model_scores, position):
    """Fallback: position-specific 4-axis radar. Missing models get neutral 50."""
    models = POSITION_AXES.get(position, POSITION_AXES["CM"])
    has_any = any(model_scores.get(m) is not None for m in models)
    if not has_any:
        return None, None
    values = [model_scores.get(m) if model_scores.get(m) is not None else 50 for m in models]
    return values, models


def compute_percentiles(player_group):
    """Percentile rank each axis within the group. All players must have same axis count."""
    if not player_group:
        return {}

    pids = list(player_group.keys())
    n_axes = len(next(iter(player_group.values())))

    # Check all have same axis count
    valid = {pid: axes for pid, axes in player_group.items() if len(axes) == n_axes}
    if len(valid) < 2:
        return {pid: axes for pid, axes in valid.items()}  # Can't percentile with <2

    pids = list(valid.keys())
    matrix = np.array([valid[pid] for pid in pids], dtype=float)

    percentiles = np.zeros_like(matrix)
    for col in range(n_axes):
        vals = matrix[:, col]
        ranks = np.array([np.sum(vals < v) / max(len(vals) - 1, 1) for v in vals])
        percentiles[:, col] = np.round(ranks * 100).astype(int)

    return {pid: percentiles[i].astype(int).tolist() for i, pid in enumerate(pids)}


def main():
    parser = argparse.ArgumentParser(description="Compute role-specific percentile radar fingerprints")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--player", type=str, help="Filter by player name")
    parser.add_argument("--force", action="store_true", help="Overwrite existing fingerprints")
    parser.add_argument("--pool", choices=["role", "position", "global"], default="role",
                        help="Percentile pool: 'role' (default, rank within same role), "
                             "'position' (rank within position group), 'global' (all outfield together)")
    args = parser.parse_args()

    conn = require_conn()
    cur = conn.cursor()

    print("60 — Role-Specific Percentile Radar Fingerprints")
    print(f"  Pool: {args.pool}")

    # Load data
    print("  Loading attribute grades...")
    cur.execute("SELECT player_id, attribute, scout_grade, stat_score, source FROM attribute_grades")
    rows = cur.fetchall()

    grades_by_player = {}
    for pid, attr, sg, ss, src in rows:
        grades_by_player.setdefault(pid, []).append((attr, sg, ss, src))

    print(f"  {len(grades_by_player)} players with grades")

    cur.execute("SELECT person_id, position, best_role FROM player_profiles WHERE position IS NOT NULL")
    profile_rows = cur.fetchall()
    positions = {}
    best_roles = {}
    for pid, pos, br in profile_rows:
        positions[pid] = pos
        if br:
            best_roles[pid] = br

    print(f"  {len(best_roles)} players with best_role")

    # Compute all model scores
    all_model_scores = {}
    for pid, grades in grades_by_player.items():
        pos = positions.get(pid)
        if not pos:
            continue
        ms = compute_model_scores(grades)
        if any(v is not None and v > 0 for v in ms.values()):
            all_model_scores[pid] = ms

    print(f"  {len(all_model_scores)} players with model scores")

    # First pass: count players per role to identify small pools
    role_counts = {}
    for pid in all_model_scores:
        br = best_roles.get(pid)
        if br and br in ROLE_AXES:
            role_counts[br] = role_counts.get(br, 0) + 1

    small_roles = {r for r, c in role_counts.items() if c < MIN_POOL_SIZE}
    if small_roles:
        print(f"  {len(small_roles)} roles below min pool size ({MIN_POOL_SIZE}), will use position fallback")

    # Compute raw axes (role-specific where possible, generic fallback)
    player_axes = {}   # pid → raw axis values
    player_labels = {} # pid → axis model names
    player_groups = {} # group_key → {pid: axes} (for percentiling)

    for pid, ms in all_model_scores.items():
        pos = positions.get(pid, "CM")
        br = best_roles.get(pid)

        # Try role-specific axes (skip if pool too small)
        axes = None
        labels = None
        if br and br in ROLE_AXES and br not in small_roles:
            axes, labels = role_axes(ms, br)

        # Fallback to position axes
        if not axes:
            axes, labels = generic_axes(ms, pos)

        if not axes or len(axes) < 2:
            continue

        player_axes[pid] = axes
        player_labels[pid] = labels

        # Determine percentile group — group by axis count + group key
        n_axes = len(axes)
        if args.pool == "role" and br and br in ROLE_AXES and br not in small_roles:
            group_key = f"role:{br}:{n_axes}"
        elif args.pool == "position" or (br and br in small_roles):
            group_key = f"pos:{pos}:{n_axes}"
        else:
            group_key = f"global:{n_axes}"

        player_groups.setdefault(group_key, {})[pid] = axes

    print(f"  {len(player_axes)} players with computable fingerprints")
    print(f"  {len(player_groups)} percentile groups")

    # Compute percentiles per group
    all_fingerprints = {}
    for group_key, group in sorted(player_groups.items()):
        pctiles = compute_percentiles(group)
        all_fingerprints.update(pctiles)
        label = group_key.split(":")[1]
        print(f"    {label}: {len(group)} players")

    # Filter if --player
    if args.player:
        cur.execute("SELECT id, name FROM people WHERE name ILIKE %s", (f"%{args.player}%",))
        matches = cur.fetchall()
        match_ids = {r[0] for r in matches}
        all_fingerprints = {pid: fp for pid, fp in all_fingerprints.items() if pid in match_ids}

    print(f"\n  Total fingerprints: {len(all_fingerprints)}")

    # Sample output
    sample_names = ["Erling Haaland", "Rodri", "Bukayo Saka", "Trent Alexander-Arnold", "Vinícius Júnior"]
    cur.execute("SELECT id, name FROM people WHERE name = ANY(%s)", (sample_names,))
    for pid, name in cur.fetchall():
        fp = all_fingerprints.get(pid)
        if fp:
            pos = positions.get(pid, "?")
            br = best_roles.get(pid, "generic")
            lbls = player_labels.get(pid, [])
            short = [MODEL_SHORT.get(m, m[:3]) for m in lbls]
            print(f"    {name:30s} ({pos:3s} {br:20s}): {' '.join(f'{l}:{v:2d}' for l, v in zip(short, fp))}")

    if args.dry_run:
        print("\n  DRY RUN — no changes written")
        conn.close()
        return

    # Write
    print(f"\n  Writing {len(all_fingerprints)} fingerprints...")
    batch = [(json.dumps(fp), pid) for pid, fp in all_fingerprints.items()]

    if args.force:
        cur.executemany(
            "UPDATE player_profiles SET fingerprint = %s WHERE person_id = %s",
            batch,
        )
    else:
        cur.executemany(
            "UPDATE player_profiles SET fingerprint = %s WHERE person_id = %s AND fingerprint IS NULL",
            batch,
        )

    updated = cur.rowcount
    conn.commit()
    print(f"  Updated {updated} rows")

    conn.close()
    print("\n  Done.")


if __name__ == "__main__":
    main()
