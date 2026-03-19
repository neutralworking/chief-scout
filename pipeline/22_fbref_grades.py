"""
22_fbref_grades.py — FBRef season stats → attribute_grades.

Computes position-group percentile scores on the 1-20 SACROSANCT scale
from fbref_player_season_stats and writes to attribute_grades (source='fbref').

Uses shared lib/grades.py for position grouping, percentile ranking,
and grade writing. New sources can be added by writing a fetch function.

Usage:
    python 22_fbref_grades.py                        # all positions
    python 22_fbref_grades.py --position attacker    # filter by position group
    python 22_fbref_grades.py --season 2024-2025     # specific season
    python 22_fbref_grades.py --dry-run              # preview without writing
    python 22_fbref_grades.py --min-minutes 450      # require 450+ mins (default)
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from lib.db import require_conn, get_dict_cursor
from lib.grades import (
    get_position_group,
    per90, safe_float,
    compute_positional_percentiles, percentile_to_score_20,
    build_grade_rows, write_grades,
)

# ── Argument parsing ─────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="FBRef season stats → attribute grades")
parser.add_argument("--season", type=str, default=None,
                    help="Specific season (e.g. 2024-2025). Default: latest available")
parser.add_argument("--position", choices=["attacker", "midfielder", "defender", "gk", "all"],
                    default="all", help="Position group filter (default: all)")
parser.add_argument("--min-minutes", type=int, default=450,
                    help="Minimum minutes played (default: 450)")
parser.add_argument("--dry-run", action="store_true",
                    help="Preview without writing to database")
args = parser.parse_args()

DRY_RUN = args.dry_run
MIN_MINUTES = args.min_minutes
SEASON = args.season
POS_FILTER = args.position

# ── Metric → SACROSANCT attribute mapping ────────────────────────────────────

METRIC_TO_ATTRIBUTE = {
    "finishing":            "close_range",
    "shot_accuracy":        "mid_range",
    "xg_overperformance":   "long_range",
    "creativity":           "creativity",
    "vision":               "vision",
    "pass_accuracy":        "pass_accuracy",
    "progressive_passing":  "pass_range",
    "through_balls_proxy":  "through_balls",
    "tackling":             "tackling",
    "blocks":               "blocking",
    "clearances":           "clearances",
    "interceptions":        "interceptions",
    "defensive_work":       "awareness",
    "dribbling":            "take_ons",
    "progressive_carrying": "carries",
    "gk_shot_stopping":     "reactions",
    "gk_saves_rate":        "handling",
    "gk_clean_sheet_rate":  "footwork",
}

METRIC_POSITIONS = {
    "finishing":            {"attacker", "midfielder"},
    "shot_accuracy":        {"attacker", "midfielder"},
    "xg_overperformance":   {"attacker", "midfielder"},
    "creativity":           {"attacker", "midfielder", "defender"},
    "vision":               {"attacker", "midfielder"},
    "pass_accuracy":        {"attacker", "midfielder", "defender"},
    "progressive_passing":  {"attacker", "midfielder", "defender"},
    "through_balls_proxy":  {"attacker", "midfielder"},
    "tackling":             {"midfielder", "defender"},
    "blocks":               {"midfielder", "defender"},
    "clearances":           {"defender"},
    "interceptions":        {"midfielder", "defender"},
    "defensive_work":       {"midfielder", "defender"},
    "dribbling":            {"attacker", "midfielder"},
    "progressive_carrying": {"attacker", "midfielder"},
    "gk_shot_stopping":     {"gk"},
    "gk_saves_rate":        {"gk"},
    "gk_clean_sheet_rate":  {"gk"},
}


def fetch_fbref(cur) -> tuple[dict, dict]:
    """Fetch FBRef season stats → (player_metrics, player_positions)."""
    print("\n── FBRef ──────────────────────────────────────────────────────────")

    season_clause = ""
    params = [MIN_MINUTES]
    if SEASON:
        season_clause = "AND s.season = %s"
        params.append(SEASON)

    cur.execute(f"""
        SELECT
            fp.person_id, s.season, s.minutes, s.matches_played,
            s.goals, s.assists, s.shots, s.shots_on_target,
            s.xg, s.npxg, s.xag, s.pass_pct,
            s.progressive_passes, s.key_passes,
            s.tackles, s.tackles_won, s.interceptions,
            s.blocks, s.clearances,
            s.progressive_carries, s.successful_dribbles, s.dribbles_attempted,
            s.gk_saves, s.gk_save_pct, s.gk_clean_sheets, s.gk_goals_against, s.gk_psxg,
            pp.position
        FROM fbref_player_season_stats s
        JOIN fbref_players fp ON fp.fbref_id = s.fbref_id
        LEFT JOIN player_profiles pp ON pp.person_id = fp.person_id
        WHERE fp.person_id IS NOT NULL
          AND s.minutes >= %s
          {season_clause}
        ORDER BY fp.person_id, s.season DESC
    """, params)

    rows = cur.fetchall()
    print(f"  Qualifying rows (>={MIN_MINUTES} min): {len(rows)}")
    if not rows:
        return {}, {}

    seen = set()
    player_metrics = {}
    player_positions = {}

    for r in rows:
        pid = r["person_id"]
        if pid in seen:
            continue
        seen.add(pid)

        mins = r["minutes"] or 0
        if mins <= 0:
            continue

        pg = get_position_group(r["position"])
        player_positions[pid] = pg
        m = {}

        if pg != "gk":
            m["finishing"] = per90(r.get("goals"), mins)
            shots = r.get("shots") or 0
            if shots >= 5:
                m["shot_accuracy"] = safe_float((r.get("shots_on_target") or 0) / shots * 100)
            xg = r.get("xg")
            if xg is not None:
                m["xg_overperformance"] = per90((r.get("goals") or 0) - float(xg), mins)
            key_passes = r.get("key_passes")
            if key_passes is not None:
                m["creativity"] = per90(key_passes, mins)
            elif (r.get("assists") or 0) > 0:
                m["creativity"] = per90(r.get("assists"), mins)
            xag = r.get("xag")
            if xag is not None:
                m["vision"] = per90(float(xag), mins)
            elif (r.get("assists") or 0) > 0:
                m["vision"] = per90(r.get("assists"), mins)
            if r.get("pass_pct") is not None:
                m["pass_accuracy"] = safe_float(float(r["pass_pct"]))
            m["progressive_passing"] = per90(r.get("progressive_passes"), mins)
            m["tackling"] = per90(r.get("tackles_won"), mins)
            m["interceptions"] = per90(r.get("interceptions"), mins)
            tackles = r.get("tackles") or 0
            intercepts = r.get("interceptions") or 0
            m["defensive_work"] = per90(tackles + intercepts, mins)
            m["blocks"] = per90(r.get("blocks") or 0, mins)
            m["clearances"] = per90(r.get("clearances") or 0, mins)
            drib_att = r.get("dribbles_attempted") or 0
            if drib_att >= 5:
                m["dribbling"] = safe_float((r.get("successful_dribbles") or 0) / drib_att * 100)
            m["progressive_carrying"] = per90(r.get("progressive_carries"), mins)
            if xag is not None:
                m["through_balls_proxy"] = per90(float(xag), mins)
            elif (r.get("assists") or 0) > 0:
                m["through_balls_proxy"] = per90(r.get("assists"), mins)

        if pg == "gk" or (pg is None and (r.get("gk_saves") or 0) > 0):
            if r.get("gk_save_pct") is not None:
                m["gk_saves_rate"] = safe_float(float(r["gk_save_pct"]))
            matches = r.get("matches_played") or 1
            if matches >= 3:
                m["gk_clean_sheet_rate"] = safe_float((r.get("gk_clean_sheets") or 0) / matches * 100)
            if r.get("gk_psxg") is not None and r.get("gk_goals_against") is not None:
                m["gk_shot_stopping"] = per90(float(r["gk_psxg"]) - (r["gk_goals_against"] or 0), mins)

        player_metrics[pid] = {k: v for k, v in m.items() if v is not None}

    print(f"  Unique players with metrics: {len(player_metrics)}")
    return player_metrics, player_positions


def main():
    print("22 — FBRef Season Stats → Attribute Grades")
    print(f"  Season:      {SEASON or 'latest available'}")
    print(f"  Position:    {POS_FILTER}")
    print(f"  Min minutes: {MIN_MINUTES}")
    print(f"  Dry run:     {DRY_RUN}")

    conn = require_conn()
    cur = get_dict_cursor(conn)

    player_metrics, player_positions = fetch_fbref(cur)

    if not player_metrics:
        print("  No data to process.")
        conn.close()
        return

    if POS_FILTER != "all":
        player_metrics = {pid: m for pid, m in player_metrics.items()
                          if player_positions.get(pid) == POS_FILTER or
                          (player_positions.get(pid) is None and POS_FILTER != "gk")}
        player_positions = {pid: pg for pid, pg in player_positions.items() if pid in player_metrics}
        print(f"  After position filter ({POS_FILTER}): {len(player_metrics)}")

    scores = compute_positional_percentiles(
        player_metrics, player_positions,
        metric_position_filter=METRIC_POSITIONS,
        score_fn=percentile_to_score_20,
    )

    rows = build_grade_rows(scores, METRIC_TO_ATTRIBUTE, source="fbref")
    print(f"  Grade rows: {len(rows)} for {len(scores)} players")

    if scores:
        sample_pid = next(iter(scores))
        print(f"\n  Sample (person_id={sample_pid}):")
        for metric, sc in sorted(scores[sample_pid].items()):
            attr = METRIC_TO_ATTRIBUTE.get(metric, "(unmapped)")
            raw = player_metrics.get(sample_pid, {}).get(metric, "?")
            if isinstance(raw, float):
                raw = f"{raw:.2f}"
            print(f"    {metric:25s} → {attr:15s}  raw={str(raw):>8s}  score={sc:2d}/20")

    write_grades(conn, rows, source="fbref", dry_run=DRY_RUN)

    print(f"\n── Summary ───────────────────────────────────────────────────────")
    print(f"  Total grades: {len(rows):,}")
    if DRY_RUN:
        print("  (dry-run — no data was written)")

    conn.close()


if __name__ == "__main__":
    main()
