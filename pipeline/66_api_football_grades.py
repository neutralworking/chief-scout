"""
66_api_football_grades.py — Convert API-Football stats into attribute_grades.

Computes position-group percentile scores (1-10 SACROSANCT scale) from
api_football_player_stats with league-strength coefficient scaling.

Usage:
    python 66_api_football_grades.py                  # default: latest season
    python 66_api_football_grades.py --season 2025
    python 66_api_football_grades.py --min-minutes 450
    python 66_api_football_grades.py --dry-run
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from lib.db import require_conn, get_dict_cursor
from lib.grades import (
    get_position_group, percentile_rank, percentile_to_score_10,
    per90, pct, write_grades,
)

# ── Args ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="API-Football stats → attribute_grades")
parser.add_argument("--season", default="2025", help="Season year (default: 2025)")
parser.add_argument("--min-minutes", type=int, default=450, help="Minimum minutes (default: 450)")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
args = parser.parse_args()

DRY_RUN = args.dry_run
MIN_MINUTES = args.min_minutes
SOURCE = "api_football"

# ── Composite attribute mapping ──────────────────────────────────────────────
# Each attribute blends multiple raw metrics with weights.
# Percentile ranking happens on the blended value, not individual stats.
# Inverted signals (lower=better) are marked with "_inv" suffix in metrics.

COMPOSITE_MAP = {
    # ── Striker model ────────────────────────────────────────────────────────
    # Advanced metrics: goals_per_shot (conversion), npg_p90 (non-pen goals),
    # avg_rating in every attr. These separate Kane (0.38 conv, 7.95 rating)
    # from Chris Wood (0.12 conv, 6.58 rating).
    "close_range": {
        "signals": [("goals_per_shot", 0.35), ("npg_p90", 0.30), ("avg_rating", 0.20), ("shot_accuracy", 0.15)],
        "positions": {"attacker", "midfielder"},
    },
    "mid_range": {
        "signals": [("shot_accuracy", 0.35), ("goals_per_shot", 0.25), ("avg_rating", 0.20), ("shots_p90", 0.20)],
        "positions": {"attacker", "midfielder"},
    },
    "long_range": {
        "signals": [("shots_p90", 0.35), ("shot_distance_bias", 0.30), ("goals_p90", 0.20), ("avg_rating", 0.15)],
        "positions": {"attacker", "midfielder"},
    },
    "penalties": {
        "signals": [("penalty_pct", 0.70), ("avg_rating", 0.30)],
        "positions": {"attacker"},
    },
    # ── Creator model ────────────────────────────────────────────────────────
    # Each attribute has a distinct dominant signal to avoid overlap:
    # creativity=key_passes, vision=assists, flair=dribble_success, threat=shots
    "creativity": {
        "signals": [("key_passes_p90", 0.40), ("dribbles_p90", 0.25), ("assists_p90", 0.20), ("fouls_drawn_p90", 0.15)],
        "positions": {"attacker", "midfielder", "defender"},
    },
    "vision": {
        "signals": [("assists_p90", 0.40), ("key_passes_p90", 0.30), ("avg_rating", 0.30)],
        "positions": {"attacker", "midfielder"},
    },
    "flair": {
        "signals": [("dribble_success_rate", 0.40), ("fouls_drawn_p90", 0.35), ("dribbles_p90", 0.25)],
        "positions": {"attacker", "midfielder"},
    },
    "threat": {
        "signals": [("shots_p90", 0.35), ("goals_p90", 0.30), ("key_passes_p90", 0.20), ("assists_p90", 0.15)],
        "positions": {"attacker", "midfielder"},
    },
    # ── Passer model ─────────────────────────────────────────────────────────
    "pass_accuracy": {
        "signals": [("pass_accuracy", 0.55), ("pass_volume_quality", 0.35), ("avg_rating", 0.10)],
        "positions": {"attacker", "midfielder", "defender"},
    },
    "through_balls": {
        "signals": [("assists_p90", 0.35), ("key_passes_p90", 0.35), ("pass_volume_quality", 0.30)],
        "positions": {"attacker", "midfielder"},
    },
    # ── Dribbler model ───────────────────────────────────────────────────────
    "take_ons": {
        "signals": [("dribbles_p90", 0.55), ("dribble_success_rate", 0.35), ("fouls_drawn_p90", 0.10)],
        "positions": {"attacker", "midfielder"},
    },
    "skills": {
        "signals": [("dribble_success_rate", 0.45), ("avg_rating", 0.30), ("dribbles_p90", 0.25)],
        "positions": {"attacker", "midfielder"},
    },
    # ── Cover model ──────────────────────────────────────────────────────────
    "awareness": {
        "signals": [("interceptions_p90", 0.35), ("avg_rating", 0.35), ("tackles_p90", 0.15), ("blocks_p90", 0.15)],
        "positions": {"midfielder", "defender"},
    },
    "discipline": {
        "signals": [("cards_p90_inv", 0.40), ("fouls_p90_inv", 0.40), ("avg_rating", 0.20)],
        "positions": {"attacker", "midfielder", "defender"},
    },
    "interceptions": {
        "signals": [("interceptions_p90", 0.60), ("avg_rating", 0.25), ("blocks_p90", 0.15)],
        "positions": {"midfielder", "defender"},
    },
    # ── Destroyer model ──────────────────────────────────────────────────────
    "blocking": {
        "signals": [("blocks_p90", 0.50), ("duel_win_pct", 0.30), ("duels_won_p90", 0.20)],
        "positions": {"midfielder", "defender"},
    },
    "tackling": {
        "signals": [("tackles_p90", 0.55), ("duel_win_pct", 0.30), ("fouls_committed_p90", 0.15)],
        "positions": {"midfielder", "defender"},
    },
    "marking": {
        "signals": [("duel_win_pct", 0.40), ("tackles_p90", 0.30), ("interceptions_p90", 0.20), ("avg_rating", 0.10)],
        "positions": {"defender"},
    },
    # ── Powerhouse model ─────────────────────────────────────────────────────
    "duels": {
        "signals": [("duels_won_p90", 0.45), ("duel_win_pct", 0.35), ("avg_rating", 0.20)],
        "positions": {"attacker", "midfielder", "defender"},
    },
    "aggression": {
        "signals": [("fouls_committed_p90", 0.40), ("duels_won_p90", 0.30), ("tackles_p90", 0.30)],
        "positions": {"attacker", "midfielder", "defender"},
    },
    # ── Controller model ─────────────────────────────────────────────────────
    "composure": {
        "signals": [("avg_rating", 0.50), ("pass_accuracy", 0.25), ("cards_p90_inv", 0.25)],
        "positions": {"attacker", "midfielder", "defender"},
    },
    # ── Engine model ─────────────────────────────────────────────────────────
    # Pressing = disciplined ball recovery (fouls_inv rewards clean tackling).
    # Contrast with aggression which rewards fouling.
    "pressing": {
        "signals": [("interceptions_p90", 0.35), ("tackles_p90", 0.35), ("fouls_p90_inv", 0.30)],
        "positions": {"attacker", "midfielder", "defender"},
    },
}


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    conn = require_conn()
    cur = get_dict_cursor(conn)

    print(f"API-Football grades — season {args.season}, min {MIN_MINUTES} minutes")
    print(f"  Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}")

    # Load league strength factors for grade scaling
    cur.execute("SELECT league_name, strength_factor FROM league_coefficients WHERE season = %s", (args.season,))
    league_strength = {r["league_name"]: float(r["strength_factor"]) for r in cur.fetchall()}
    default_strength = 0.50
    print(f"  Loaded {len(league_strength)} league strength factors")

    cur.execute("""
        SELECT
            s.person_id, s.minutes, s.appearances, s.rating,
            s.goals, s.assists,
            s.shots_total, s.shots_on,
            s.passes_total, s.passes_key, s.passes_accuracy,
            s.tackles_total, s.blocks, s.interceptions,
            s.duels_total, s.duels_won,
            s.dribbles_attempted, s.dribbles_success,
            s.fouls_drawn, s.fouls_committed,
            s.cards_yellow, s.cards_red,
            s.penalties_scored, s.penalties_missed,
            pp.position, s.league_name
        FROM api_football_player_stats s
        LEFT JOIN player_profiles pp ON pp.person_id = s.person_id
        WHERE s.season = %s AND s.person_id IS NOT NULL AND s.minutes >= %s
    """, (args.season, MIN_MINUTES))

    players = cur.fetchall()
    print(f"  Loaded {len(players)} matched players with >= {MIN_MINUTES} min")

    if not players:
        print("  No data to process.")
        conn.close()
        return

    # ── Compute raw metrics per player ────────────────────────────────────────

    player_metrics = {}
    player_positions = {}
    player_league_strength = {}

    def infer_position_group(p):
        """Infer attacker/midfielder/defender from stats when profile position is missing."""
        pos = p.get("position")
        if pos:
            return get_position_group(pos)
        # Heuristic: goals+assists heavy → attacker, tackles+interceptions heavy → defender
        mins = p["minutes"] or 1
        goals_assists_p90 = ((p["goals"] or 0) + (p["assists"] or 0)) / mins * 90
        def_actions_p90 = ((p["tackles_total"] or 0) + (p["interceptions"] or 0) + (p["blocks"] or 0)) / mins * 90
        if goals_assists_p90 >= 0.6:
            return "attacker"
        if def_actions_p90 >= 5.0 and goals_assists_p90 < 0.2:
            return "defender"
        return "midfielder"

    for p in players:
        pid = p["person_id"]
        mins = p["minutes"]
        pos_group = infer_position_group(p) or "midfielder"
        player_positions[pid] = pos_group
        player_league_strength[pid] = league_strength.get(p["league_name"], default_strength)

        metrics = {}
        # ── Raw per-90 and percentage metrics ────────────────────────────────
        metrics["goals_p90"] = per90(p["goals"], mins)
        metrics["shots_p90"] = per90(p["shots_total"], mins)
        metrics["shot_accuracy"] = pct(p["shots_on"], p["shots_total"])
        metrics["assists_p90"] = per90(p["assists"], mins)
        metrics["key_passes_p90"] = per90(p["passes_key"], mins)
        metrics["pass_accuracy"] = float(p["passes_accuracy"]) if p["passes_accuracy"] is not None else None
        metrics["tackles_p90"] = per90(p["tackles_total"], mins)
        metrics["blocks_p90"] = per90(p["blocks"], mins)
        metrics["interceptions_p90"] = per90(p["interceptions"], mins)
        metrics["duel_win_pct"] = pct(p["duels_won"], p["duels_total"])
        metrics["duels_won_p90"] = per90(p["duels_won"], mins)
        metrics["dribbles_p90"] = per90(p["dribbles_success"], mins)
        metrics["dribble_success_rate"] = pct(p["dribbles_success"], p["dribbles_attempted"])
        metrics["fouls_drawn_p90"] = per90(p["fouls_drawn"], mins)
        metrics["fouls_committed_p90"] = per90(p["fouls_committed"], mins)
        total_cards = (p["cards_yellow"] or 0) + (p["cards_red"] or 0) * 2
        metrics["cards_p90"] = per90(total_cards, mins)
        pen_total = (p["penalties_scored"] or 0) + (p["penalties_missed"] or 0)
        metrics["penalty_pct"] = pct(p["penalties_scored"], pen_total, min_denom=2) if pen_total >= 2 else None
        metrics["avg_rating"] = float(p["rating"]) if p["rating"] else None

        # ── Derived / composite raw signals ──────────────────────────────────
        # Inverted metrics (lower raw = better) — flip so higher = better
        metrics["cards_p90_inv"] = (1.0 / max(metrics["cards_p90"], 0.01)) if metrics["cards_p90"] is not None else None
        metrics["fouls_p90_inv"] = (1.0 / max(metrics["fouls_committed_p90"], 0.01)) if metrics["fouls_committed_p90"] is not None else None
        # Long range bias: low shot accuracy = more long-range attempts
        metrics["shot_distance_bias"] = (1.0 - (metrics["shot_accuracy"] or 0) / 100.0) if metrics["shot_accuracy"] is not None else None
        # Pass volume quality: passes_p90 × accuracy (rewards accurate high-volume passers)
        passes_p90 = per90(p["passes_total"], mins)
        if passes_p90 is not None and metrics["pass_accuracy"] is not None:
            metrics["pass_volume_quality"] = passes_p90 * (metrics["pass_accuracy"] / 100.0)
        else:
            metrics["pass_volume_quality"] = None
        # Goals per shot: conversion rate — quality signal that separates
        # Kane (0.38) from Chris Wood (0.12). Volume-neutral.
        shots = p["shots_total"] or 0
        goals = p["goals"] or 0
        metrics["goals_per_shot"] = (goals / shots) if shots >= 5 else None
        # Non-penalty goals p90: strips penalty inflation from goal tallies.
        pens_scored = p["penalties_scored"] or 0
        metrics["npg_p90"] = per90(goals - pens_scored, mins) if goals >= pens_scored else metrics["goals_p90"]
        # Goal involvement p90: goals + assists combined output
        metrics["goal_involvement_p90"] = per90(goals + (p["assists"] or 0), mins)

        player_metrics[pid] = metrics

    # ── Percentile ranking with league strength pre-scaling ─────────────────
    # Strength is applied to raw metric values BEFORE ranking, so a PL player's
    # 0.25 goals p90 × 1.15 = 0.29 competes fairly against a weak-league
    # player's 0.40 × 0.50 = 0.20. This produces correct ordinals.

    groups = {"attacker": [], "midfielder": [], "defender": [], "gk": []}
    for pid, pos_group in player_positions.items():
        groups.setdefault(pos_group, []).append(pid)

    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    grades_to_write = []

    # ── Step 1: Rank each raw signal independently per position group ────────
    # This normalizes all signals to 0-100 percentile so they can be blended
    # without scale differences (pass_accuracy 0-100% vs goals_p90 0-3).

    # Collect all signal names used across composites
    all_signal_names = set()
    for config in COMPOSITE_MAP.values():
        for metric_name, _ in config["signals"]:
            all_signal_names.add(metric_name)

    # signal_percentiles[pos_group][metric_name][pid] = percentile (0-100)
    signal_percentiles: dict[str, dict[str, dict[int, float]]] = {}

    for pos_group in ["attacker", "midfielder", "defender"]:
        pids_in_group = groups.get(pos_group, [])
        if len(pids_in_group) < 3:
            continue
        signal_percentiles[pos_group] = {}

        for metric_name in all_signal_names:
            # Build (pid, value) pairs with league strength pre-scaling
            values = []
            for pid in pids_in_group:
                raw_val = player_metrics.get(pid, {}).get(metric_name)
                if raw_val is None:
                    values.append((pid, None))
                else:
                    strength = player_league_strength.get(pid, 1.0)
                    adjusted = float(raw_val) * strength
                    values.append((pid, adjusted))

            ranks = percentile_rank(values)
            signal_percentiles[pos_group][metric_name] = ranks

    # ── Step 2: Blend signal percentiles per attribute ────────────────────────

    for attr_name, config in COMPOSITE_MAP.items():
        signals = config["signals"]
        valid_positions = config["positions"]

        for pos_group in valid_positions:
            if pos_group not in signal_percentiles:
                continue
            pids_in_group = groups.get(pos_group, [])

            for pid in pids_in_group:
                # Weighted average of signal percentiles
                blend = 0.0
                total_weight = 0.0
                for metric_name, weight in signals:
                    pct_val = signal_percentiles[pos_group].get(metric_name, {}).get(pid)
                    if pct_val is not None:
                        blend += pct_val * weight
                        total_weight += weight

                if total_weight == 0:
                    continue

                blended_pct = blend / total_weight
                score = percentile_to_score_10(blended_pct)
                grades_to_write.append({
                    "player_id": pid,
                    "attribute": attr_name,
                    "stat_score": score,
                    "source": SOURCE,
                    "is_inferred": True,
                    "confidence": "Medium",
                    "updated_at": now_iso,
                })

    # Deduplicate (keep first per player+attribute)
    seen = set()
    deduped = []
    for g in grades_to_write:
        key = (g["player_id"], g["attribute"])
        if key not in seen:
            seen.add(key)
            deduped.append(g)
    grades_to_write = deduped

    print(f"  Computed {len(grades_to_write)} grade rows for {len(player_metrics)} players")
    print(f"  Avg grades per player: {len(grades_to_write) / max(len(player_metrics), 1):.1f}")

    if grades_to_write:
        sample_pid = grades_to_write[0]["player_id"]
        sample = [g for g in grades_to_write if g["player_id"] == sample_pid]
        print(f"\n  Sample (person_id={sample_pid}):")
        for g in sample[:8]:
            print(f"    {g['attribute']:20s} = {g['stat_score']}")

    write_grades(conn, grades_to_write, source=SOURCE, dry_run=DRY_RUN)
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
