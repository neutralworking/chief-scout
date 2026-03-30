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

METRIC_MAP = {
    # Attacking
    "goals_p90":          {"attr": "close_range",   "positions": {"attacker", "midfielder"}},
    "shot_accuracy":      {"attr": "mid_range",     "positions": {"attacker", "midfielder"}},
    "shots_p90":          {"attr": "long_range",    "positions": {"attacker", "midfielder"}},
    # Passing
    "key_passes_p90":     {"attr": "creativity",    "positions": {"attacker", "midfielder", "defender"}},
    "assists_p90":        {"attr": "vision",        "positions": {"attacker", "midfielder"}},
    "pass_accuracy":      {"attr": "pass_accuracy", "positions": {"attacker", "midfielder", "defender"}},
    # Defending
    "blocks_p90":         {"attr": "blocking",      "positions": {"midfielder", "defender"}},
    "interceptions_p90":  {"attr": "interceptions", "positions": {"midfielder", "defender"}},
    "def_actions_p90":    {"attr": "awareness",     "positions": {"midfielder", "defender"}},
    "clearances_p90":     {"attr": "marking",       "positions": {"defender"}},
    # Duels
    "duel_win_pct":       {"attr": "duels",         "positions": {"attacker", "midfielder", "defender"}},
    # Dribbling
    "dribbles_p90":       {"attr": "take_ons",      "positions": {"attacker", "midfielder"}},
    # Discipline (inverted — more cards = lower score)
    "discipline":         {"attr": "discipline",    "positions": {"attacker", "midfielder", "defender"}},
    # Match rating (form/composure proxy)
    "avg_rating":         {"attr": "composure",     "positions": {"attacker", "midfielder", "defender"}},
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
        metrics["goals_p90"] = per90(p["goals"], mins)
        metrics["shots_p90"] = per90(shots_total, mins)
        metrics["shot_accuracy"] = pct(shots_on_est, shots_total) if shots_total >= 5 else None
        metrics["assists_p90"] = per90(p["assists"], mins)
        metrics["key_passes_p90"] = per90(p["key_passes"], mins)
        # AllSportsAPI passes_accuracy is raw count of accurate passes, not %
        metrics["pass_accuracy"] = pct(p["passes_accuracy"], p["passes_total"])
        metrics["blocks_p90"] = per90(p["blocks"], mins)
        metrics["interceptions_p90"] = per90(p["interceptions"], mins)
        metrics["def_actions_p90"] = per90((p["tackles"] or 0) + (p["interceptions"] or 0), mins)
        metrics["clearances_p90"] = per90(p["clearances"], mins)
        metrics["duel_win_pct"] = pct(p["duels_won"], p["duels_total"])
        metrics["dribbles_p90"] = per90(p["dribble_success"], mins)
        total_cards = (p["cards_yellow"] or 0) + (p["cards_red"] or 0) * 2
        metrics["discipline"] = per90(total_cards, mins)
        metrics["avg_rating"] = float(p["rating"]) if p["rating"] else None

        player_metrics[pid] = metrics

    # ── Percentile ranking with league strength pre-scaling ─────────────────

    groups = {"attacker": [], "midfielder": [], "defender": [], "gk": []}
    for pid, pos_group in player_positions.items():
        groups.setdefault(pos_group, []).append(pid)

    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    grades_to_write = []

    for metric_name, config in METRIC_MAP.items():
        attr_name = config["attr"]
        valid_positions = config["positions"]
        is_inverted = metric_name == "discipline"

        for pos_group in valid_positions:
            pids_in_group = groups.get(pos_group, [])
            if len(pids_in_group) < 3:
                continue

            values = []
            for pid in pids_in_group:
                raw_val = player_metrics.get(pid, {}).get(metric_name)
                if raw_val is None:
                    values.append((pid, None))
                else:
                    raw_val = float(raw_val)
                    strength = player_league_strength.get(pid, 0.35)
                    if is_inverted:
                        adjusted = raw_val / max(strength, 0.3)
                    else:
                        adjusted = raw_val * strength
                    values.append((pid, adjusted))

            ranks = percentile_rank(values)

            for pid, pct_val in ranks.items():
                if is_inverted:
                    pct_val = 100 - pct_val
                score = percentile_to_score_10(pct_val)
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
