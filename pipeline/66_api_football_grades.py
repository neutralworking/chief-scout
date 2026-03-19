"""
66_api_football_grades.py — Convert API-Football stats into attribute_grades.

Computes position-group percentile scores (1-10 SACROSANCT scale) from
api_football_player_stats. Follows the same methodology as 22_fbref_grades.py.

Usage:
    python 66_api_football_grades.py                  # default: latest season
    python 66_api_football_grades.py --season 2025
    python 66_api_football_grades.py --min-minutes 450
    python 66_api_football_grades.py --dry-run
"""

import argparse
import math
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from lib.db import require_conn, get_dict_cursor

# ── Args ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="API-Football stats → attribute_grades")
parser.add_argument("--season", default="2025", help="Season year (default: 2025)")
parser.add_argument("--min-minutes", type=int, default=450, help="Minimum minutes (default: 450)")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
args = parser.parse_args()

DRY_RUN = args.dry_run
MIN_MINUTES = args.min_minutes
SOURCE = "api_football"

# ── Position grouping ────────────────────────────────────────────────────────

ATTACKER_POS = {"CF", "WF", "AM"}
MIDFIELDER_POS = {"CM", "DM", "WM"}
DEFENDER_POS = {"CD", "WD"}
GK_POS = {"GK"}


def get_position_group(position: str | None) -> str:
    if not position:
        return "midfielder"  # fallback
    pos = position.upper().strip()
    if pos in ATTACKER_POS:
        return "attacker"
    if pos in MIDFIELDER_POS:
        return "midfielder"
    if pos in DEFENDER_POS:
        return "defender"
    if pos in GK_POS:
        return "gk"
    return "midfielder"


# ── Metric → Attribute mapping ───────────────────────────────────────────────
#
# Internal metric name → SACROSANCT attribute name
# Each metric has a list of position groups it applies to.

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
    "tackles_p90":        {"attr": "tackling",      "positions": {"midfielder", "defender"}},
    "blocks_p90":         {"attr": "blocking",      "positions": {"midfielder", "defender"}},
    "interceptions_p90":  {"attr": "interceptions", "positions": {"midfielder", "defender"}},
    "def_actions_p90":    {"attr": "awareness",     "positions": {"midfielder", "defender"}},
    # Duels
    "duel_win_pct":       {"attr": "duels",         "positions": {"attacker", "midfielder", "defender"}},
    # Dribbling
    "dribble_success_pct": {"attr": "take_ons",     "positions": {"attacker", "midfielder"}},
    # Physical proxy
    "fouls_drawn_p90":    {"attr": "guile",         "positions": {"attacker", "midfielder"}},
    # Discipline (inverted — more cards = lower score)
    "discipline":         {"attr": "discipline",    "positions": {"attacker", "midfielder", "defender"}},
    # Penalties
    "penalty_pct":        {"attr": "penalties",     "positions": {"attacker"}},
    # Match rating (form/composure proxy)
    "avg_rating":         {"attr": "composure",     "positions": {"attacker", "midfielder", "defender"}},
}

# ── Helpers ───────────────────────────────────────────────────────────────────


def _per90(val, minutes):
    if not val or not minutes or minutes < 1:
        return None
    return val / minutes * 90


def _pct(num, denom, min_denom=5):
    if not num or not denom or denom < min_denom:
        return None
    return num / denom * 100


def percentile_to_score(pct: float) -> int:
    """Convert 0-100 percentile rank to 1-10 SACROSANCT scale."""
    return max(1, min(10, round(pct / 10)))


def compute_percentile_ranks(values: list[tuple]) -> dict:
    """Given [(player_id, value), ...], return {player_id: percentile 0-100}.

    Uses rank-based percentiles within the group.
    """
    # Filter out None values
    valid = [(pid, v) for pid, v in values if v is not None]
    if len(valid) < 3:
        return {}

    # Sort by value ascending
    sorted_vals = sorted(valid, key=lambda x: x[1])
    n = len(sorted_vals)
    ranks = {}
    for i, (pid, _) in enumerate(sorted_vals):
        ranks[pid] = (i / max(n - 1, 1)) * 100

    return ranks


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    conn = require_conn()
    cur = get_dict_cursor(conn)

    print(f"API-Football grades — season {args.season}, min {MIN_MINUTES} minutes")
    print(f"  Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}")

    # ── 1. Load player stats with position data ──────────────────────────────

    cur.execute("""
        SELECT
            s.person_id,
            s.api_football_id,
            s.minutes,
            s.appearances,
            s.rating,
            s.goals, s.assists,
            s.shots_total, s.shots_on,
            s.passes_total, s.passes_key, s.passes_accuracy,
            s.tackles_total, s.blocks, s.interceptions,
            s.duels_total, s.duels_won,
            s.dribbles_attempted, s.dribbles_success,
            s.fouls_drawn, s.fouls_committed,
            s.cards_yellow, s.cards_red,
            s.penalties_scored, s.penalties_missed,
            pp.position
        FROM api_football_player_stats s
        JOIN player_profiles pp ON pp.person_id = s.person_id
        WHERE s.season = %s
          AND s.person_id IS NOT NULL
          AND s.minutes >= %s
    """, (args.season, MIN_MINUTES))

    players = cur.fetchall()
    print(f"  Loaded {len(players)} matched players with >= {MIN_MINUTES} min")

    if not players:
        print("  No data to process.")
        conn.close()
        return

    # ── 2. Compute raw metrics per player ────────────────────────────────────

    player_metrics = {}  # person_id → {metric_name: value}
    player_positions = {}  # person_id → position_group

    for p in players:
        pid = p["person_id"]
        mins = p["minutes"]
        pos_group = get_position_group(p["position"])
        player_positions[pid] = pos_group

        metrics = {}

        # Attacking
        metrics["goals_p90"] = _per90(p["goals"], mins)
        metrics["shots_p90"] = _per90(p["shots_total"], mins)
        metrics["shot_accuracy"] = _pct(p["shots_on"], p["shots_total"])
        metrics["assists_p90"] = _per90(p["assists"], mins)

        # Passing
        metrics["passes_key_p90"] = _per90(p["passes_key"], mins)
        metrics["pass_accuracy"] = p["passes_accuracy"]  # already a percentage

        # Defending
        metrics["tackles_p90"] = _per90(p["tackles_total"], mins)
        metrics["blocks_p90"] = _per90(p["blocks"], mins)
        metrics["interceptions_p90"] = _per90(p["interceptions"], mins)
        metrics["def_actions_p90"] = _per90(
            (p["tackles_total"] or 0) + (p["interceptions"] or 0), mins
        )

        # Duels
        metrics["duel_win_pct"] = _pct(p["duels_won"], p["duels_total"])

        # Dribbling
        metrics["dribble_success_pct"] = _pct(p["dribbles_success"], p["dribbles_attempted"])

        # Fouls drawn (guile)
        metrics["fouls_drawn_p90"] = _per90(p["fouls_drawn"], mins)

        # Discipline (inverted: fewer cards = higher score)
        total_cards = (p["cards_yellow"] or 0) + (p["cards_red"] or 0) * 2
        cards_p90 = _per90(total_cards, mins)
        # Invert: high cards → low discipline. Use 100 - percentile later.
        metrics["discipline"] = cards_p90

        # Penalties
        pen_total = (p["penalties_scored"] or 0) + (p["penalties_missed"] or 0)
        metrics["penalty_pct"] = _pct(p["penalties_scored"], pen_total, min_denom=2) if pen_total >= 2 else None

        # Match rating
        metrics["avg_rating"] = float(p["rating"]) if p["rating"] else None

        player_metrics[pid] = metrics

    # ── 3. Percentile ranking within position groups ─────────────────────────

    # Group players by position
    groups = {"attacker": [], "midfielder": [], "defender": [], "gk": []}
    for pid, pos_group in player_positions.items():
        groups.setdefault(pos_group, []).append(pid)

    # For each metric, compute percentiles within each position group
    grades_to_write = []

    for metric_name, config in METRIC_MAP.items():
        attr_name = config["attr"]
        valid_positions = config["positions"]
        is_inverted = metric_name == "discipline"

        for pos_group in valid_positions:
            pids_in_group = groups.get(pos_group, [])
            if len(pids_in_group) < 3:
                continue

            # Collect values for this metric in this position group
            values = []
            for pid in pids_in_group:
                val = player_metrics.get(pid, {}).get(metric_name)
                if val is not None:
                    values.append((pid, val))

            if len(values) < 3:
                continue

            ranks = compute_percentile_ranks(values)

            for pid, pct in ranks.items():
                if is_inverted:
                    pct = 100 - pct  # fewer cards = better discipline
                score = percentile_to_score(pct)
                grades_to_write.append({
                    "player_id": pid,
                    "attribute": attr_name,
                    "stat_score": score,
                    "source": SOURCE,
                    "is_inferred": True,
                    "confidence": "Medium",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })

    # Deduplicate: if a player appears in multiple position groups for the same
    # attribute, keep the one from their primary position group
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

    # Sample output
    if grades_to_write:
        sample_pid = grades_to_write[0]["player_id"]
        sample = [g for g in grades_to_write if g["player_id"] == sample_pid]
        print(f"\n  Sample (person_id={sample_pid}):")
        for g in sample[:8]:
            print(f"    {g['attribute']:20s} = {g['stat_score']}")

    if DRY_RUN:
        print("\n  [dry-run] Would write grades. Exiting.")
        conn.close()
        return

    # ── 4. Write to attribute_grades ─────────────────────────────────────────

    # Use a regular cursor for writes
    write_cur = conn.cursor()

    # Clear old API-Football grades
    write_cur.execute("DELETE FROM attribute_grades WHERE source = %s", (SOURCE,))
    deleted = write_cur.rowcount
    print(f"\n  Cleared {deleted} old '{SOURCE}' grades")

    # Batch insert
    from psycopg2.extras import execute_values

    BATCH = 500
    for i in range(0, len(grades_to_write), BATCH):
        batch = grades_to_write[i:i + BATCH]
        execute_values(write_cur, """
            INSERT INTO attribute_grades (player_id, attribute, stat_score, source, is_inferred, confidence, updated_at)
            VALUES %s
            ON CONFLICT (player_id, attribute, source) DO UPDATE SET
                stat_score = EXCLUDED.stat_score,
                is_inferred = EXCLUDED.is_inferred,
                confidence = EXCLUDED.confidence,
                updated_at = EXCLUDED.updated_at
        """, [
            (g["player_id"], g["attribute"], g["stat_score"], g["source"],
             g["is_inferred"], g["confidence"], g["updated_at"])
            for g in batch
        ])

    conn.commit()
    conn.close()

    print(f"  Written {len(grades_to_write)} grades (source='{SOURCE}')")
    print("Done.")


if __name__ == "__main__":
    main()
