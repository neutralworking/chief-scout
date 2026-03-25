"""
86_stat_roles.py — Algorithmically determine best_role from player statistics.

Matches API-Football stats against tactical role profiles using position-group
percentile thresholds. Each role has a stat signature; the best-fit role is
the one where the player's stats match the most criteria at the highest level.

Usage:
    python 86_stat_roles.py                      # full run
    python 86_stat_roles.py --dry-run            # preview without writing
    python 86_stat_roles.py --min-minutes 900    # stricter minutes filter
    python 86_stat_roles.py --position CD        # single position
    python 86_stat_roles.py --season 2025
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))

from lib.db import require_conn, get_dict_cursor
from lib.grades import get_position_group, percentile_rank, per90, pct

# ── Args ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Stat-based best_role assignment")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--season", default="2025")
parser.add_argument("--min-minutes", type=int, default=450)
parser.add_argument("--position", default="", help="Filter to single position")
args = parser.parse_args()

DRY_RUN = args.dry_run

# ── Role stat signatures ─────────────────────────────────────────────────────
# Each role has metrics that must be in a certain percentile range.
# "high" = >70th pct, "very_high" = >85th pct, "medium" = >40th pct
# "low" = <30th pct (inverted — lower is better)
#
# Scores: very_high match = 3pts, high = 2pts, medium = 1pt, low = 2pts
# Best-fit role = highest total score

ROLE_PROFILES: dict[str, dict[str, list[tuple[str, str]]]] = {
    # ── GK ────────────────────────────────────────────────
    "GK": {
        "Shotstopper": [
            # Traditional shot-stopper: low passing, high saves implied by rating
            ("avg_rating", "high"),
        ],
        "Sweeper Keeper": [
            ("pass_accuracy", "high"),
            ("passes_p90", "medium"),
        ],
        "Libero GK": [
            ("pass_accuracy", "very_high"),
            ("passes_p90", "high"),
        ],
        "Comandante": [
            ("avg_rating", "very_high"),
            ("passes_p90", "medium"),
        ],
    },
    # ── CD ────────────────────────────────────────────────
    "CD": {
        "Libero": [
            ("pass_accuracy", "high"),
            ("passes_p90", "very_high"),
            ("duels_won_pct", "medium"),
        ],
        "Zagueiro": [
            ("pass_accuracy", "high"),
            ("passes_p90", "high"),
            ("tackles_p90", "medium"),
        ],
        "Stopper": [
            ("tackles_p90", "very_high"),
            ("blocks_p90", "high"),
            ("duels_won_pct", "high"),
        ],
        "Sweeper": [
            ("interceptions_p90", "very_high"),
            ("tackles_p90", "high"),
            ("pass_accuracy", "medium"),
        ],
    },
    # ── WD ────────────────────────────────────────────────
    "WD": {
        "Lateral": [
            ("passes_p90", "high"),
            ("key_passes_p90", "medium"),
            ("tackles_p90", "high"),
        ],
        "Fluidificante": [
            ("tackles_p90", "very_high"),
            ("duels_won_pct", "high"),
            ("interceptions_p90", "medium"),
        ],
        "Invertido": [
            ("dribbles_p90", "high"),
            ("key_passes_p90", "high"),
            ("passes_p90", "medium"),
        ],
        "Corredor": [
            ("passes_p90", "very_high"),
            ("dribbles_p90", "high"),
            ("tackles_p90", "medium"),
        ],
    },
    # ── DM ────────────────────────────────────────────────
    "DM": {
        "Sentinelle": [
            ("tackles_p90", "very_high"),
            ("interceptions_p90", "high"),
            ("duels_won_pct", "high"),
        ],
        "Volante": [
            ("tackles_p90", "high"),
            ("dribbles_p90", "medium"),
            ("passes_p90", "medium"),
        ],
        "Regista": [
            ("pass_accuracy", "very_high"),
            ("passes_p90", "very_high"),
            ("key_passes_p90", "high"),
        ],
        "Pivote": [
            ("tackles_p90", "high"),
            ("interceptions_p90", "high"),
            ("pass_accuracy", "medium"),
        ],
    },
    # ── CM ────────────────────────────────────────────────
    "CM": {
        "Metodista": [
            ("pass_accuracy", "very_high"),
            ("passes_p90", "very_high"),
            ("key_passes_p90", "medium"),
        ],
        "Mezzala": [
            ("goals_p90", "medium"),
            ("dribbles_p90", "high"),
            ("key_passes_p90", "high"),
        ],
        "Relayeur": [
            ("passes_p90", "high"),
            ("tackles_p90", "medium"),
            ("duels_won_pct", "medium"),
        ],
        "Tuttocampista": [
            ("goals_p90", "medium"),
            ("tackles_p90", "medium"),
            ("passes_p90", "medium"),
            ("dribbles_p90", "medium"),
        ],
    },
    # ── WM ────────────────────────────────────────────────
    "WM": {
        "Winger": [
            ("dribbles_p90", "very_high"),
            ("key_passes_p90", "high"),
            ("goals_p90", "medium"),
        ],
        "Raumdeuter": [
            ("goals_p90", "high"),
            ("shots_p90", "high"),
            ("key_passes_p90", "medium"),
        ],
        "False Winger": [
            ("key_passes_p90", "very_high"),
            ("assists_p90", "high"),
            ("dribbles_p90", "high"),
        ],
        "Tornante": [
            ("passes_p90", "high"),
            ("key_passes_p90", "high"),
            ("tackles_p90", "medium"),
        ],
        "Shuttler": [
            ("dribbles_p90", "high"),
            ("passes_p90", "high"),
            ("tackles_p90", "medium"),
        ],
    },
    # ── AM ────────────────────────────────────────────────
    "AM": {
        "Trequartista": [
            ("key_passes_p90", "very_high"),
            ("assists_p90", "high"),
            ("dribbles_p90", "high"),
        ],
        "Enganche": [
            ("key_passes_p90", "very_high"),
            ("pass_accuracy", "high"),
            ("assists_p90", "medium"),
        ],
        "Seconda Punta": [
            ("goals_p90", "high"),
            ("shots_p90", "high"),
            ("key_passes_p90", "medium"),
        ],
        "Boxcrasher": [
            ("goals_p90", "high"),
            ("dribbles_p90", "high"),
            ("duels_won_pct", "medium"),
        ],
    },
    # ── WF ────────────────────────────────────────────────
    "WF": {
        "Inside Forward": [
            ("goals_p90", "high"),
            ("shots_p90", "high"),
            ("dribbles_p90", "medium"),
        ],
        "Extremo": [
            ("dribbles_p90", "very_high"),
            ("key_passes_p90", "high"),
            ("assists_p90", "medium"),
        ],
        "Creative Winger": [
            ("key_passes_p90", "very_high"),
            ("dribbles_p90", "high"),
            ("assists_p90", "high"),
        ],
        "Raumdeuter": [
            ("goals_p90", "high"),
            ("shots_p90", "high"),
            ("key_passes_p90", "medium"),
        ],
        "Inventor": [
            ("key_passes_p90", "high"),
            ("dribbles_p90", "high"),
            ("assists_p90", "high"),
        ],
    },
    # ── CF ────────────────────────────────────────────────
    "CF": {
        "Prima Punta": [
            ("goals_p90", "very_high"),
            ("shots_p90", "high"),
            ("shot_accuracy", "high"),
        ],
        "Poacher": [
            ("goals_p90", "high"),
            ("assists_p90", "medium"),
            ("dribbles_p90", "medium"),
            ("duels_won_pct", "medium"),
        ],
        "Falso Nove": [
            ("key_passes_p90", "high"),
            ("assists_p90", "high"),
            ("dribbles_p90", "medium"),
            ("goals_p90", "medium"),
        ],
        "Spearhead": [
            ("goals_p90", "high"),
            ("shots_p90", "high"),
            ("duels_won_pct", "high"),
        ],
    },
}

# Percentile thresholds for each label
THRESHOLDS = {
    "very_high": 85,
    "high": 70,
    "medium": 40,
    "low": 30,  # inverted
}

MATCH_SCORES = {
    "very_high": 3,
    "high": 2,
    "medium": 1,
    "low": 2,
}


def main():
    conn = require_conn()
    cur = get_dict_cursor(conn)

    print(f"86 — Stat-Based Role Assignment")
    print(f"  Season: {args.season}, min minutes: {args.min_minutes}")
    print(f"  Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}")

    # ── Load stats ───────────────────────────────────────────────────────────

    pos_filter = ""
    params: list = [args.season, args.min_minutes]
    if args.position:
        pos_filter = "AND pp.position = %s"
        params.append(args.position)

    cur.execute(f"""
        SELECT
            s.person_id, pp.position, p.name,
            s.minutes, s.appearances, s.rating,
            s.goals, s.assists, s.shots_total, s.shots_on,
            s.passes_total, s.passes_key, s.passes_accuracy,
            s.tackles_total, s.blocks, s.interceptions,
            s.duels_total, s.duels_won,
            s.dribbles_attempted, s.dribbles_success,
            s.fouls_drawn
        FROM api_football_player_stats s
        JOIN player_profiles pp ON pp.person_id = s.person_id
        JOIN people p ON p.id = s.person_id
        WHERE s.season = %s AND s.person_id IS NOT NULL AND s.minutes >= %s
        {pos_filter}
    """, params)

    players = cur.fetchall()
    print(f"  Loaded {len(players)} players")

    if not players:
        print("  No data.")
        conn.close()
        return

    # ── Compute metrics ──────────────────────────────────────────────────────

    METRIC_NAMES = [
        "goals_p90", "assists_p90", "shots_p90", "shot_accuracy",
        "passes_p90", "key_passes_p90", "pass_accuracy",
        "tackles_p90", "blocks_p90", "interceptions_p90",
        "duels_won_pct", "dribbles_p90", "avg_rating",
    ]

    player_metrics: dict[int, dict[str, float | None]] = {}
    player_positions: dict[int, str] = {}
    player_names: dict[int, str] = {}

    for p in players:
        pid = p["person_id"]
        mins = p["minutes"]
        position = p["position"]
        player_positions[pid] = position
        player_names[pid] = p["name"]

        m: dict[str, float | None] = {}
        m["goals_p90"] = per90(p["goals"], mins)
        m["assists_p90"] = per90(p["assists"], mins)
        m["shots_p90"] = per90(p["shots_total"], mins)
        m["shot_accuracy"] = pct(p["shots_on"], p["shots_total"])
        m["passes_p90"] = per90(p["passes_total"], mins)
        m["key_passes_p90"] = per90(p["passes_key"], mins)
        m["pass_accuracy"] = float(p["passes_accuracy"]) if p["passes_accuracy"] else None
        m["tackles_p90"] = per90(p["tackles_total"], mins)
        m["blocks_p90"] = per90(p["blocks"], mins)
        m["interceptions_p90"] = per90(p["interceptions"], mins)
        m["duels_won_pct"] = pct(p["duels_won"], p["duels_total"])
        m["dribbles_p90"] = per90(p["dribbles_success"], mins)
        m["avg_rating"] = float(p["rating"]) if p["rating"] else None
        player_metrics[pid] = m

    # ── Compute percentiles within position groups ───────────────────────────

    pos_groups: dict[str, list[int]] = defaultdict(list)
    for pid, pos in player_positions.items():
        pos_groups[pos].append(pid)

    # {metric: {pid: percentile}}
    percentiles: dict[str, dict[int, float]] = {m: {} for m in METRIC_NAMES}

    for metric in METRIC_NAMES:
        for pos, pids in pos_groups.items():
            values = [(pid, player_metrics[pid].get(metric)) for pid in pids]
            ranks = percentile_rank(values)
            for pid, pct_val in ranks.items():
                percentiles[metric][pid] = pct_val

    # ── Match players to roles ───────────────────────────────────────────────

    assignments: dict[int, tuple[str, float]] = {}  # pid → (role, score)
    role_counts: dict[str, int] = defaultdict(int)

    for pid, pos in player_positions.items():
        profiles = ROLE_PROFILES.get(pos, {})
        if not profiles:
            continue

        best_role = None
        best_score = -1.0

        for role_name, criteria in profiles.items():
            score = 0.0
            matched = 0
            total_criteria = len(criteria)

            for metric, level in criteria:
                pct_val = percentiles.get(metric, {}).get(pid)
                if pct_val is None:
                    continue

                threshold = THRESHOLDS[level]
                if level == "low":
                    if pct_val < threshold:
                        score += MATCH_SCORES[level]
                        matched += 1
                else:
                    if pct_val >= threshold:
                        score += MATCH_SCORES[level]
                        matched += 1

            # Score = raw points, but require matching at least half the criteria
            # Bonus for full match, penalty for roles with <3 criteria (too easy)
            if total_criteria > 0 and matched >= max(total_criteria // 2, 1):
                norm_score = score
                if matched == total_criteria:
                    norm_score *= 1.3
                # Penalize roles with very few criteria (Poacher with 2 shouldn't beat Complete Forward with 4)
                if total_criteria < 3:
                    norm_score *= 0.7
                if norm_score > best_score:
                    best_score = norm_score
                    best_role = role_name

        if best_role:
            assignments[pid] = (best_role, best_score)
            role_counts[best_role] += 1

    print(f"\n  Assigned roles to {len(assignments)} players")
    print(f"\n  Role distribution:")
    for role, count in sorted(role_counts.items(), key=lambda x: -x[1]):
        print(f"    {role:20s} {count:>5}")

    # ── Show sample assignments ──────────────────────────────────────────────

    # Load current best_role for comparison
    pids_list = list(assignments.keys())
    cur.execute("SELECT person_id, best_role FROM player_profiles WHERE person_id = ANY(%s)", (pids_list,))
    old_roles = {r["person_id"]: r["best_role"] for r in cur.fetchall()}

    changed = [(pid, role, score) for pid, (role, score) in assignments.items()
               if old_roles.get(pid) != role]
    print(f"\n  Changes: {len(changed)} of {len(assignments)} ({len(changed)*100//max(len(assignments),1)}%)")

    print(f"\n  Sample changes (top 20):")
    for pid, role, score in sorted(changed, key=lambda x: -x[2])[:20]:
        old = old_roles.get(pid) or "–"
        name = player_names.get(pid, "?")
        pos = player_positions.get(pid, "?")
        print(f"    {name:25s} {pos:3s}  {old:20s} → {role:20s}  (fit={score:.2f})")

    if DRY_RUN:
        print(f"\n  --dry-run: no writes.")
        conn.rollback()
        conn.close()
        return

    # ── Write ────────────────────────────────────────────────────────────────

    from psycopg2.extras import execute_values

    rows = [(role, pid) for pid, (role, _) in assignments.items()]
    BATCH = 500
    written = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        execute_values(cur, """
            UPDATE player_profiles SET best_role = data.role
            FROM (VALUES %s) AS data(role, person_id)
            WHERE player_profiles.person_id = data.person_id::int
        """, batch)
        written += cur.rowcount

    conn.commit()
    print(f"\n  Updated {written} best_role assignments")
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
