"""
68_allsportsapi_grades.py — Convert AllSportsAPI stats into attribute_grades.

Computes position-group percentile scores (1-10 SACROSANCT scale) from
allsportsapi_player_stats with league-strength coefficient scaling.
Same methodology as 66_api_football_grades.py but reads from AllSportsAPI tables.

Usage:
    python 68_allsportsapi_grades.py                  # default: latest season
    python 68_allsportsapi_grades.py --season 2025
    python 68_allsportsapi_grades.py --min-minutes 200
    python 68_allsportsapi_grades.py --dry-run
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

parser = argparse.ArgumentParser(description="AllSportsAPI stats → attribute_grades")
parser.add_argument("--season", default="2025", help="Season year (default: 2025)")
parser.add_argument("--min-minutes", type=int, default=200, help="Minimum minutes (default: 200, lower than AF due to thinner leagues)")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
args = parser.parse_args()

DRY_RUN = args.dry_run
MIN_MINUTES = args.min_minutes
SOURCE = "allsportsapi"

# ── Metric → Attribute mapping ───────────────────────────────────────────────
# Same attributes as AF grades (script 66) for consistency.

# ── Composite attribute mapping ──────────────────────────────────────────────
# Mirrors pipeline 66 architecture. ASA has clearances + dispossessed but no fouls_drawn.

COMPOSITE_MAP = {
    # ── Striker model ────────────────────────────────────────────────────────
    # ASA: no fouls_drawn, no penalty data. Uses conversion + avg_rating.
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
    # ── Creator model ────────────────────────────────────────────────────────
    # Each attribute has a distinct dominant signal.
    # ASA: no fouls_drawn, so creativity/flair drop that signal.
    "creativity": {
        "signals": [("key_passes_p90", 0.45), ("dribbles_p90", 0.30), ("assists_p90", 0.25)],
        "positions": {"attacker", "midfielder", "defender"},
    },
    "vision": {
        "signals": [("assists_p90", 0.40), ("key_passes_p90", 0.30), ("avg_rating", 0.30)],
        "positions": {"attacker", "midfielder"},
    },
    "flair": {
        "signals": [("dribble_success_rate", 0.60), ("dribbles_p90", 0.40)],
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
    # ASA: no fouls_drawn
    "take_ons": {
        "signals": [("dribbles_p90", 0.55), ("dribble_success_rate", 0.45)],
        "positions": {"attacker", "midfielder"},
    },
    "skills": {
        "signals": [("dribble_success_rate", 0.50), ("dribbles_p90", 0.25), ("avg_rating", 0.25)],
        "positions": {"attacker", "midfielder"},
    },
    # ── Cover model ──────────────────────────────────────────────────────────
    # ASA: has clearances (unique to ASA)
    "awareness": {
        "signals": [("interceptions_p90", 0.30), ("avg_rating", 0.30), ("tackles_p90", 0.15), ("clearances_p90", 0.15), ("blocks_p90", 0.10)],
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
        "signals": [("duel_win_pct", 0.35), ("tackles_p90", 0.25), ("clearances_p90", 0.15), ("interceptions_p90", 0.15), ("avg_rating", 0.10)],
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
    "pressing": {
        "signals": [("interceptions_p90", 0.35), ("tackles_p90", 0.35), ("fouls_p90_inv", 0.30)],
        "positions": {"attacker", "midfielder", "defender"},
    },
}

# League strength overrides for AllSportsAPI leagues not in league_coefficients.
# Conservative factors — these are weaker leagues than AF covers.
ASA_LEAGUE_STRENGTH = {
    "Primera Division":         0.35,  # Bolivia
    "Ligue 1":                  0.40,  # Ivory Coast / Senegal
    "Elite One":                0.30,  # Cameroon
    "Premier League":           0.40,  # Ghana / Jamaica / New Zealand / Nigeria (context-dependent)
    "GNEF 1":                   0.45,  # Morocco
    "Liga Pro":                 0.50,  # Ecuador
    "Canadian Premier League":  0.40,  # Canada
}


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    conn = require_conn()
    cur = get_dict_cursor(conn)

    print(f"AllSportsAPI grades — season {args.season}, min {MIN_MINUTES} minutes")
    print(f"  Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}")

    # Load league strength factors from DB (for any that exist)
    cur.execute("SELECT league_name, strength_factor FROM league_coefficients WHERE season = %s", (args.season,))
    league_strength_db = {r["league_name"]: float(r["strength_factor"]) for r in cur.fetchall()}
    print(f"  Loaded {len(league_strength_db)} DB league strength factors")

    # AllSportsAPI often has appearances + goals but no minutes.
    # Use minutes if available, else estimate from appearances (avg ~70 min/app).
    # Filter on either minutes >= threshold OR appearances >= threshold/70.
    min_apps = max(3, MIN_MINUTES // 70)

    cur.execute("""
        SELECT
            s.person_id, s.minutes, s.appearances, s.rating,
            s.goals, s.assists,
            s.shots_total,
            s.passes_total, s.passes_accuracy, s.key_passes,
            s.tackles, s.blocks, s.interceptions, s.clearances,
            s.duels_total, s.duels_won,
            s.dribble_attempts, s.dribble_success,
            s.fouls_committed, s.dispossessed,
            s.cards_yellow, s.cards_red,
            s.pen_scored, s.pen_missed,
            pp.position, s.league_name
        FROM allsportsapi_player_stats s
        LEFT JOIN player_profiles pp ON pp.person_id = s.person_id
        WHERE s.season = %s AND s.person_id IS NOT NULL
          AND (s.minutes >= %s OR (s.minutes = 0 AND s.appearances >= %s))
    """, (args.season, MIN_MINUTES, min_apps))

    players = cur.fetchall()
    print(f"  Loaded {len(players)} matched players (>= {MIN_MINUTES} min or >= {min_apps} apps)")

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
        # Heuristic from position_type or stats
        mins = p["minutes"] or 1
        goals_assists_p90 = ((p["goals"] or 0) + (p["assists"] or 0)) / mins * 90
        def_actions_p90 = ((p["tackles"] or 0) + (p["interceptions"] or 0) + (p["blocks"] or 0)) / mins * 90
        if goals_assists_p90 >= 0.6:
            return "attacker"
        if def_actions_p90 >= 5.0 and goals_assists_p90 < 0.2:
            return "defender"
        return "midfielder"

    def get_strength(league_name):
        """Get league strength, checking DB first then ASA overrides."""
        if league_name in league_strength_db:
            return league_strength_db[league_name]
        return ASA_LEAGUE_STRENGTH.get(league_name, 0.35)

    for p in players:
        pid = p["person_id"]
        mins = p["minutes"] or 0
        apps = p["appearances"] or 0
        # Estimate minutes from appearances if missing
        if mins < 1 and apps >= 1:
            mins = apps * 70  # conservative: ~70 min per appearance
        if mins < 1:
            continue
        pos_group = infer_position_group(p) or "midfielder"
        player_positions[pid] = pos_group
        player_league_strength[pid] = get_strength(p["league_name"])

        shots_total = p["shots_total"] or 0
        # AllSportsAPI doesn't give shots_on, estimate from goals (conservative)
        shots_on_est = min(p["goals"] or 0, shots_total) if shots_total > 0 else 0

        metrics = {}
        # ── Raw per-90 and percentage metrics ────────────────────────────────
        metrics["goals_p90"] = per90(p["goals"], mins)
        metrics["shots_p90"] = per90(shots_total, mins)
        metrics["shot_accuracy"] = pct(shots_on_est, shots_total) if shots_total >= 5 else None
        metrics["assists_p90"] = per90(p["assists"], mins)
        metrics["key_passes_p90"] = per90(p["key_passes"], mins)
        # AllSportsAPI passes_accuracy is raw count of accurate passes, not %
        pa = pct(p["passes_accuracy"], p["passes_total"])
        metrics["pass_accuracy"] = float(pa) if pa is not None else None
        metrics["blocks_p90"] = per90(p["blocks"], mins)
        metrics["interceptions_p90"] = per90(p["interceptions"], mins)
        metrics["clearances_p90"] = per90(p["clearances"], mins)
        metrics["tackles_p90"] = per90(p["tackles"], mins)
        metrics["duel_win_pct"] = pct(p["duels_won"], p["duels_total"])
        metrics["duels_won_p90"] = per90(p["duels_won"], mins)
        metrics["dribbles_p90"] = per90(p["dribble_success"], mins)
        metrics["dribble_success_rate"] = pct(p["dribble_success"], p["dribble_attempts"])
        metrics["fouls_committed_p90"] = per90(p["fouls_committed"], mins)
        total_cards = (p["cards_yellow"] or 0) + (p["cards_red"] or 0) * 2
        metrics["cards_p90"] = per90(total_cards, mins)
        metrics["avg_rating"] = float(p["rating"]) if p["rating"] else None

        # ── Derived signals ──────────────────────────────────────────────────
        metrics["cards_p90_inv"] = (1.0 / max(metrics["cards_p90"], 0.01)) if metrics["cards_p90"] is not None else None
        metrics["fouls_p90_inv"] = (1.0 / max(metrics["fouls_committed_p90"], 0.01)) if metrics["fouls_committed_p90"] is not None else None
        metrics["shot_distance_bias"] = (1.0 - (metrics["shot_accuracy"] or 0) / 100.0) if metrics["shot_accuracy"] is not None else None
        passes_p90 = per90(p["passes_total"], mins)
        if passes_p90 is not None and metrics["pass_accuracy"] is not None:
            metrics["pass_volume_quality"] = passes_p90 * (metrics["pass_accuracy"] / 100.0)
        else:
            metrics["pass_volume_quality"] = None
        # Goals per shot: conversion rate
        shots = p["shots_total"] or 0
        goals = p["goals"] or 0
        metrics["goals_per_shot"] = (goals / shots) if shots >= 5 else None
        # Non-penalty goals p90
        pens_scored = p.get("pen_scored") or 0
        metrics["npg_p90"] = per90(goals - pens_scored, mins) if goals >= pens_scored else metrics["goals_p90"]
        # Goal involvement p90
        metrics["goal_involvement_p90"] = per90(goals + (p["assists"] or 0), mins)

        player_metrics[pid] = metrics

    # ── Percentile ranking with league strength pre-scaling ─────────────────

    groups = {"attacker": [], "midfielder": [], "defender": [], "gk": []}
    for pid, pos_group in player_positions.items():
        groups.setdefault(pos_group, []).append(pid)

    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    grades_to_write = []

    # ── Step 1: Rank each signal independently per position group ────────────
    all_signal_names = set()
    for config in COMPOSITE_MAP.values():
        for metric_name, _ in config["signals"]:
            all_signal_names.add(metric_name)

    signal_percentiles: dict[str, dict[str, dict[int, float]]] = {}

    for pos_group in ["attacker", "midfielder", "defender"]:
        pids_in_group = groups.get(pos_group, [])
        if len(pids_in_group) < 3:
            continue
        signal_percentiles[pos_group] = {}

        for metric_name in all_signal_names:
            values = []
            for pid in pids_in_group:
                raw_val = player_metrics.get(pid, {}).get(metric_name)
                if raw_val is None:
                    values.append((pid, None))
                else:
                    strength = player_league_strength.get(pid, 0.35)
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
                    "confidence": "Low",  # Lower confidence than AF (thinner data)
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

    n_players = len(player_metrics)
    print(f"  Computed {len(grades_to_write)} grade rows for {n_players} players")
    if n_players > 0:
        print(f"  Avg grades per player: {len(grades_to_write) / n_players:.1f}")

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
