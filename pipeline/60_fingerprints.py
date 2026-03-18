#!/usr/bin/env python3
"""51 — Compute role-specific percentile radar fingerprints.

For each player with a best_role, picks the 4-5 models that define that
role, computes raw model scores from attribute_grades, then ranks each
axis as a percentile within the role's player pool (role-pool) or
position group (position-pool).

Falls back to generic 6-axis (DEF/CRE/ATK/PWR/PAC/DRV) for players
without a best_role.

Usage:
    python 51_fingerprints.py [--dry-run] [--player NAME] [--force]
    python 51_fingerprints.py [--pool role|position|global]
"""

import argparse
import json
import sys

import numpy as np

from lib.db import require_conn
from lib.models import MODEL_ATTRIBUTES, MODEL_SHORT, ATTR_ALIASES, SOURCE_PRIORITY

# Role → relevant models (4-5 axes). Must match apps/web/src/lib/role-radar.ts.
ROLE_AXES = {
    # GK
    "Shot Stopper":       ["GK", "Cover", "Commander", "Target"],
    "Sweeper Keeper":     ["GK", "Passer", "Controller", "Cover"],
    "Sweeper":            ["GK", "Passer", "Controller", "Cover"],
    # CD
    "Stopper":            ["Destroyer", "Cover", "Powerhouse", "Target", "Commander"],
    "Ball-Playing CB":    ["Cover", "Passer", "Controller", "Destroyer"],
    "Enforcer":           ["Destroyer", "Commander", "Powerhouse", "Cover"],
    "Ball-Carrier":       ["Cover", "Dribbler", "Passer", "Controller"],
    "Ball-Carrying CB":   ["Cover", "Dribbler", "Passer", "Controller"],
    # WD
    "Overlapping FB":     ["Engine", "Dribbler", "Sprinter", "Passer"],
    "Overlapping Full-Back": ["Engine", "Dribbler", "Sprinter", "Passer"],
    "Inverted FB":        ["Cover", "Passer", "Controller", "Engine"],
    "Inverted Full-Back": ["Cover", "Passer", "Controller", "Engine"],
    "Wing-Back":          ["Engine", "Sprinter", "Dribbler", "Cover"],
    "Lateral":            ["Engine", "Sprinter", "Dribbler", "Cover"],
    # DM
    "Anchor":             ["Cover", "Destroyer", "Controller", "Commander"],
    "Sentinelle":         ["Cover", "Destroyer", "Controller", "Commander"],
    "Regista":            ["Controller", "Passer", "Creator", "Cover"],
    "Ball Winner":        ["Destroyer", "Engine", "Powerhouse", "Cover"],
    "Ball-Winner":        ["Destroyer", "Engine", "Powerhouse", "Cover"],
    # CM
    "Deep Playmaker":     ["Controller", "Passer", "Creator", "Cover"],
    "Metodista":          ["Controller", "Passer", "Creator", "Cover"],
    "Box-to-Box":         ["Engine", "Cover", "Destroyer", "Powerhouse", "Sprinter"],
    "Tuttocampista":      ["Engine", "Cover", "Destroyer", "Powerhouse", "Sprinter"],
    "Mezzala":            ["Passer", "Creator", "Dribbler", "Engine"],
    # WM
    "Wide Playmaker":     ["Dribbler", "Passer", "Creator", "Controller"],
    "Traditional Winger": ["Engine", "Sprinter", "Dribbler", "Passer"],
    "Direct Winger":      ["Sprinter", "Dribbler", "Engine", "Passer"],
    "Wide Provider":      ["Passer", "Engine", "Controller", "Dribbler"],
    # AM
    "Trequartista":       ["Creator", "Dribbler", "Controller", "Striker"],
    "Advanced Playmaker": ["Controller", "Creator", "Passer", "Dribbler"],
    "Shadow Striker":     ["Dribbler", "Striker", "Sprinter", "Engine"],
    "Enganche":           ["Creator", "Dribbler", "Controller", "Passer"],
    # WF
    "Inside Forward":     ["Dribbler", "Sprinter", "Striker", "Creator"],
    "Extremo":            ["Sprinter", "Dribbler", "Striker", "Creator"],
    "Wide Forward":       ["Striker", "Dribbler", "Sprinter", "Passer"],
    "Inverted Winger":    ["Creator", "Dribbler", "Passer", "Sprinter"],
    # CF
    "Target Man":         ["Striker", "Target", "Powerhouse", "Commander"],
    "Complete Forward":   ["Target", "Powerhouse", "Striker", "Engine"],
    "Poacher":            ["Striker", "Sprinter", "Dribbler", "Target"],
    "False 9":            ["Dribbler", "Striker", "Creator", "Controller"],
    "Deep-Lying Forward": ["Creator", "Striker", "Passer", "Engine"],
    "Pressing Forward":   ["Engine", "Destroyer", "Striker", "Sprinter"],
    "Raumdeuter":         ["Cover", "Striker", "Engine", "Sprinter"],
    "Seconda Punta":      ["Striker", "Dribbler", "Sprinter", "Creator"],
}



def compute_model_scores(grades):
    """Compute model scores (0-100) from attribute grades."""
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

    model_scores = {}
    for model, attrs in MODEL_ATTRIBUTES.items():
        vals = [attr_scores[a] for a in attrs if a in attr_scores]
        model_scores[model] = round(sum(vals) / len(vals)) if vals else None

    return model_scores


def role_axes(model_scores, role):
    """Extract model values for a role's specific axes."""
    models = ROLE_AXES.get(role)
    if not models:
        return None
    return [model_scores.get(m) or 0 for m in models]


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
    """Fallback: position-specific 4-axis radar."""
    models = POSITION_AXES.get(position, POSITION_AXES["CM"])
    return [model_scores.get(m) or 0 for m in models]


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

    print("51 — Role-Specific Percentile Radar Fingerprints")
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

    # Compute raw axes (role-specific where possible, generic fallback)
    player_axes = {}   # pid → raw axis values
    player_groups = {} # group_key → {pid: axes} (for percentiling)

    for pid, ms in all_model_scores.items():
        pos = positions.get(pid, "CM")
        br = best_roles.get(pid)

        # Try role-specific axes
        if br and br in ROLE_AXES:
            axes = role_axes(ms, br)
        else:
            axes = generic_axes(ms, pos)

        if not axes or not any(v > 0 for v in axes):
            continue

        player_axes[pid] = axes

        # Determine percentile group
        if args.pool == "role" and br and br in ROLE_AXES:
            n_axes = len(ROLE_AXES[br])
            group_key = f"role:{br}:{n_axes}"
        elif args.pool == "position":
            n_axes = len(axes)
            group_key = f"pos:{pos}:{n_axes}"
        else:
            n_axes = len(axes)
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
            role_models = ROLE_AXES.get(br)
            if role_models:
                labels = [MODEL_SHORT.get(m, m[:3]) for m in role_models]
            elif pos == "GK":
                labels = ["STP", "CMD", "SWP", "DST"]
            else:
                labels = ["DEF", "CRE", "ATK", "PWR", "PAC", "DRV"]
            print(f"    {name:30s} ({pos:3s} {br:20s}): {' '.join(f'{l}:{v:2d}' for l, v in zip(labels, fp))}")

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
