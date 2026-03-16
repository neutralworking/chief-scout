#!/usr/bin/env python3
"""51 — Compute percentile-based radar fingerprints for all players.

For each player, computes 6-axis (outfield) or 4-axis (GK) model scores
from attribute_grades, then ranks each axis as a percentile (0-100)
across the full population. Stores the result as a JSON array in
player_profiles.fingerprint.

Usage:
    python 51_fingerprints.py [--dry-run] [--player NAME] [--force]
"""

import argparse
import json
import os
import sys

import psycopg2
import numpy as np
from dotenv import load_dotenv

load_dotenv()

DSN = os.environ.get("POSTGRES_DSN")
if not DSN:
    print("POSTGRES_DSN not set")
    sys.exit(1)

# 13 models → 4 attributes each (mirrors API radar route)
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

ATTR_ALIASES = {"takeons": "take_ons", "unpredicability": "unpredictability"}
SOURCE_PRIORITY = {"scout_assessment": 5, "statsbomb": 4, "fbref": 3, "understat": 2, "eafc_inferred": 1, "computed": 1}


def compute_model_scores(grades):
    """From a list of (attribute, scout_grade, stat_score, source) tuples,
    compute model scores (0-100) for all 13 models."""
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


def model_scores_to_axes(model_scores, position):
    """Convert 13 model scores to 6-axis (outfield) or 4-axis (GK) raw values."""
    def avg(*models):
        vals = [model_scores[m] for m in models if model_scores.get(m) is not None]
        return round(sum(vals) / len(vals)) if vals else 0

    if position == "GK":
        return [
            model_scores.get("GK") or 0,
            model_scores.get("Commander") or 0,
            model_scores.get("Cover") or 0,
            model_scores.get("Passer") or 0,
        ]

    return [
        avg("Cover", "Destroyer"),       # DEF
        avg("Creator", "Passer"),         # CRE
        avg("Striker", "Dribbler"),       # ATK
        avg("Powerhouse", "Target"),      # PWR
        model_scores.get("Sprinter") or 0,  # PAC
        avg("Engine", "Commander", "Controller"),  # DRV
    ]


def main():
    parser = argparse.ArgumentParser(description="Compute percentile radar fingerprints")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--player", type=str, help="Filter by player name")
    parser.add_argument("--force", action="store_true", help="Overwrite existing fingerprints")
    parser.add_argument("--pool", choices=["position", "global"], default="position",
                        help="Percentile pool: 'position' (default, rank within position group) or 'global' (rank against all players)")
    args = parser.parse_args()

    conn = psycopg2.connect(DSN)
    cur = conn.cursor()

    print("51 — Percentile Radar Fingerprints")

    # Fetch all attribute grades
    print("  Loading attribute grades...")
    cur.execute("SELECT player_id, attribute, scout_grade, stat_score, source FROM attribute_grades")
    rows = cur.fetchall()

    # Group by player
    grades_by_player = {}
    for pid, attr, sg, ss, src in rows:
        grades_by_player.setdefault(pid, []).append((attr, sg, ss, src))

    print(f"  {len(grades_by_player)} players with grades")

    # Fetch positions
    cur.execute("SELECT person_id, position FROM player_profiles WHERE position IS NOT NULL")
    positions = dict(cur.fetchall())

    # Compute raw axis values for all players
    player_axes = {}  # pid → [axis values]
    for pid, grades in grades_by_player.items():
        pos = positions.get(pid)
        if not pos:
            continue
        ms = compute_model_scores(grades)
        axes = model_scores_to_axes(ms, pos)
        if any(v > 0 for v in axes):
            player_axes[pid] = axes

    print(f"  {len(player_axes)} players with computable fingerprints")

    def compute_percentiles(player_group):
        """Convert raw axis values to percentile ranks within the group."""
        if not player_group:
            return {}

        pids = list(player_group.keys())
        n_axes = len(next(iter(player_group.values())))
        matrix = np.array([player_group[pid] for pid in pids], dtype=float)

        percentiles = np.zeros_like(matrix)
        for col in range(n_axes):
            vals = matrix[:, col]
            ranks = np.array([np.sum(vals < v) / max(len(vals) - 1, 1) for v in vals])
            percentiles[:, col] = np.round(ranks * 100).astype(int)

        return {pid: percentiles[i].astype(int).tolist() for i, pid in enumerate(pids)}

    # Group players into percentile pools
    all_fingerprints = {}

    if args.pool == "position":
        # Rank within position group (CD vs CD, WF vs WF, etc.)
        # GK always separate (4-axis vs 6-axis)
        pos_groups = {}
        for pid, axes in player_axes.items():
            pos = positions.get(pid, "CM")
            pos_groups.setdefault(pos, {})[pid] = axes

        for pos, group in sorted(pos_groups.items()):
            pctiles = compute_percentiles(group)
            all_fingerprints.update(pctiles)
            print(f"    {pos}: {len(group)} players")
    else:
        # Global pool — outfield and GK computed separately (different axis count)
        outfield = {pid: axes for pid, axes in player_axes.items() if positions.get(pid) != "GK"}
        gk = {pid: axes for pid, axes in player_axes.items() if positions.get(pid) == "GK"}
        print(f"    Outfield: {len(outfield)} players")
        print(f"    GK: {len(gk)} players")
        all_fingerprints.update(compute_percentiles(outfield))
        all_fingerprints.update(compute_percentiles(gk))

    print(f"  Pool: {args.pool}")

    # Filter if --player
    if args.player:
        cur.execute("SELECT id, name FROM people WHERE name ILIKE %s", (f"%{args.player}%",))
        matches = cur.fetchall()
        match_ids = {r[0] for r in matches}
        all_fingerprints = {pid: fp for pid, fp in all_fingerprints.items() if pid in match_ids}
        for pid, name in matches:
            fp = all_fingerprints.get(pid)
            if fp:
                pos = positions.get(pid, "?")
                labels = ["STP", "CMD", "SWP", "DST"] if pos == "GK" else ["DEF", "CRE", "ATK", "PWR", "PAC", "DRV"]
                print(f"    {name} ({pos}): {' '.join(f'{l}:{v}' for l, v in zip(labels, fp))}")

    print(f"\n  Total fingerprints: {len(all_fingerprints)}")

    # Sample some to verify
    sample_names = ["Erling Haaland", "Rodri", "Bukayo Saka", "Trent Alexander-Arnold", "Vinícius Júnior"]
    cur.execute("SELECT id, name FROM people WHERE name = ANY(%s)", (sample_names,))
    for pid, name in cur.fetchall():
        fp = all_fingerprints.get(pid)
        if fp:
            pos = positions.get(pid, "?")
            labels = ["STP", "CMD", "SWP", "DST"] if pos == "GK" else ["DEF", "CRE", "ATK", "PWR", "PAC", "DRV"]
            print(f"    {name:30s} ({pos:3s}): {' '.join(f'{l}:{v:2d}' for l, v in zip(labels, fp))}")

    if args.dry_run:
        print("\n  DRY RUN — no changes written")
        conn.close()
        return

    # Write to player_profiles
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
