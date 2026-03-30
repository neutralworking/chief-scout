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

# ── Metric → Attribute mapping ───────────────────────────────────────────────

METRIC_MAP = {
    # Attacking
    "goals_p90":          {"attr": "close_range",   "positions": {"attacker", "midfielder"}},
    "shot_accuracy":      {"attr": "mid_range",     "positions": {"attacker", "midfielder"}},
    "shots_p90":          {"attr": "long_range",    "positions": {"attacker", "midfielder"}},
    # Passing
    "passes_key_p90":     {"attr": "creativity",    "positions": {"attacker", "midfielder", "defender"}},
    "assists_p90":        {"attr": "vision",        "positions": {"attacker", "midfielder"}},
    "pass_accuracy":      {"attr": "pass_accuracy", "positions": {"attacker", "midfielder", "defender"}},
    # Defending
    # tackles_p90 REMOVED: volume metric, not quality. Positional CBs (Dias,
    # VVD) get 1/10 because they rarely need to tackle. def_actions_p90
    # already captures overall defensive contribution via awareness.
    "blocks_p90":         {"attr": "blocking",      "positions": {"midfielder", "defender"}},
    "interceptions_p90":  {"attr": "interceptions", "positions": {"midfielder", "defender"}},
    "def_actions_p90":    {"attr": "awareness",     "positions": {"midfielder", "defender"}},
    # Duels
    "duel_win_pct":       {"attr": "duels",         "positions": {"attacker", "midfielder", "defender"}},
    # Dribbling (volume of successful dribbles, not success %)
    "dribbles_p90":         {"attr": "take_ons",     "positions": {"attacker", "midfielder"}},
    # Physical proxy
    "fouls_drawn_p90":    {"attr": "guile",         "positions": {"attacker", "midfielder"}},
    # Discipline (inverted — more cards = lower score)
    "discipline":         {"attr": "discipline",    "positions": {"attacker", "midfielder", "defender"}},
    # Penalties
    "penalty_pct":        {"attr": "penalties",     "positions": {"attacker"}},
    # Match rating (form/composure proxy)
    "avg_rating":         {"attr": "composure",     "positions": {"attacker", "midfielder", "defender"}},
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
        metrics["goals_p90"] = per90(p["goals"], mins)
        metrics["shots_p90"] = per90(p["shots_total"], mins)
        metrics["shot_accuracy"] = pct(p["shots_on"], p["shots_total"])
        metrics["assists_p90"] = per90(p["assists"], mins)
        metrics["passes_key_p90"] = per90(p["passes_key"], mins)
        metrics["pass_accuracy"] = p["passes_accuracy"]
        metrics["tackles_p90"] = per90(p["tackles_total"], mins)
        metrics["blocks_p90"] = per90(p["blocks"], mins)
        metrics["interceptions_p90"] = per90(p["interceptions"], mins)
        metrics["def_actions_p90"] = per90((p["tackles_total"] or 0) + (p["interceptions"] or 0), mins)
        metrics["duel_win_pct"] = pct(p["duels_won"], p["duels_total"])
        metrics["dribbles_p90"] = per90(p["dribbles_success"], mins)
        metrics["fouls_drawn_p90"] = per90(p["fouls_drawn"], mins)
        total_cards = (p["cards_yellow"] or 0) + (p["cards_red"] or 0) * 2
        metrics["discipline"] = per90(total_cards, mins)
        pen_total = (p["penalties_scored"] or 0) + (p["penalties_missed"] or 0)
        metrics["penalty_pct"] = pct(p["penalties_scored"], pen_total, min_denom=2) if pen_total >= 2 else None
        metrics["avg_rating"] = float(p["rating"]) if p["rating"] else None

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

    for metric_name, config in METRIC_MAP.items():
        attr_name = config["attr"]
        valid_positions = config["positions"]
        is_inverted = metric_name == "discipline"

        for pos_group in valid_positions:
            pids_in_group = groups.get(pos_group, [])
            if len(pids_in_group) < 3:
                continue

            # Pre-scale raw values by league strength before ranking
            values = []
            for pid in pids_in_group:
                raw_val = player_metrics.get(pid, {}).get(metric_name)
                if raw_val is None:
                    values.append((pid, None))
                else:
                    raw_val = float(raw_val)
                    strength = player_league_strength.get(pid, 1.0)
                    # For inverted metrics (discipline=cards), stronger league
                    # should penalise LESS, so divide instead of multiply
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
