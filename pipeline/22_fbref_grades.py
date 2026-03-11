"""
22_fbref_grades.py — Convert FBRef season stats into per-player attribute grades,
writing results to `attribute_grades` with source='fbref'.

This fills a critical gap: defensive metrics (tackles, interceptions, blocks,
clearances), passing accuracy, progressive actions, dribbling, and GK stats
from FBRef all get converted into the 1-20 grading scale alongside existing
StatsBomb and Understat grades.

Usage:
    python 22_fbref_grades.py                        # all positions
    python 22_fbref_grades.py --position attacker    # attackers only
    python 22_fbref_grades.py --season 2024-2025     # specific season
    python 22_fbref_grades.py --dry-run              # preview without writing
    python 22_fbref_grades.py --force                # overwrite existing rows
    python 22_fbref_grades.py --min-minutes 450      # require 450+ mins (default)
"""
import argparse
import math
import sys
from datetime import datetime, timezone

from supabase import create_client

from config import POSTGRES_DSN, SUPABASE_URL, SUPABASE_SERVICE_KEY

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Build attribute grades from FBRef season stats")
parser.add_argument("--season", type=str, default=None,
                    help="Specific season to process (e.g. 2024-2025). Default: latest available")
parser.add_argument("--position", choices=["attacker", "midfielder", "defender", "gk", "all"],
                    default="all", help="Position group to process (default: all)")
parser.add_argument("--min-minutes", type=int, default=450,
                    help="Minimum minutes played to qualify (default: 450 = ~5 full matches)")
parser.add_argument("--dry-run", action="store_true",
                    help="Print summaries without writing to database")
parser.add_argument("--force", action="store_true",
                    help="Overwrite existing fbref stat_score values")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
MIN_MINUTES = args.min_minutes
SEASON = args.season
POS_FILTER = args.position
CHUNK_SIZE = 200

# ── Connections ────────────────────────────────────────────────────────────────

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env")
    sys.exit(1)
if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
sb_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── Position grouping ─────────────────────────────────────────────────────────

ATTACKER_POS = {"CF", "WF", "AM"}
MIDFIELDER_POS = {"CM", "DM", "WM"}
DEFENDER_POS = {"CD", "WD"}
GK_POS = {"GK"}

# Metrics relevant per position group
ATTACKER_METRICS = {
    "finishing", "shot_accuracy", "creativity", "vision",
    "dribbling", "progressive_carrying", "progressive_passing",
    "xg_overperformance",
}
MIDFIELDER_METRICS = {
    "pass_accuracy", "progressive_passing", "creativity", "vision",
    "tackling", "interceptions", "defensive_work", "dribbling",
    "progressive_carrying", "composure",
}
DEFENDER_METRICS = {
    "tackling", "interceptions", "blocks_clearances", "aerial_presence",
    "pass_accuracy", "progressive_passing", "composure", "defensive_work",
}
GK_METRICS = {
    "gk_shot_stopping", "gk_saves_rate", "gk_clean_sheet_rate",
}


def get_position_group(position):
    if position in ATTACKER_POS:
        return "attacker"
    if position in MIDFIELDER_POS:
        return "midfielder"
    if position in DEFENDER_POS:
        return "defender"
    if position in GK_POS:
        return "gk"
    return None


def metric_relevant(metric, pos_group):
    if pos_group is None:
        return True
    if pos_group == "attacker":
        return metric in ATTACKER_METRICS
    if pos_group == "midfielder":
        return metric in MIDFIELDER_METRICS
    if pos_group == "defender":
        return metric in DEFENDER_METRICS
    if pos_group == "gk":
        return metric in GK_METRICS
    return True


# ── Helpers ────────────────────────────────────────────────────────────────────

def _safe(val):
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val


def _per90(val, minutes):
    if minutes is None or minutes <= 0 or val is None:
        return None
    return _safe(val / minutes * 90)


def percentile_rank(values):
    sorted_vals = sorted(values, key=lambda x: x[1])
    n = len(sorted_vals)
    if n == 0:
        return {}
    ranks = {}
    for rank_pos, (idx, _val) in enumerate(sorted_vals):
        ranks[idx] = (rank_pos / max(n - 1, 1)) * 100
    return ranks


def percentile_to_score(pct):
    return max(1, min(20, round(pct / 5)))


def compute_positional_percentiles(player_metrics, player_positions):
    all_metrics = set()
    for metrics in player_metrics.values():
        all_metrics.update(metrics.keys())

    groups = {}
    for pid, pg in player_positions.items():
        if pid in player_metrics:
            groups.setdefault(pg or "unknown", []).append(pid)

    results = {}

    for metric in all_metrics:
        for group_name, pids in groups.items():
            vals = []
            for pid in pids:
                v = player_metrics.get(pid, {}).get(metric)
                if v is not None:
                    vals.append((pid, v))

            if len(vals) < 3:
                continue

            pct_ranks = percentile_rank(vals)
            for pid, pct in pct_ranks.items():
                if not metric_relevant(metric, group_name if group_name != "unknown" else None):
                    continue
                results.setdefault(pid, {})[metric] = percentile_to_score(pct)

    return results


def chunked_upsert(rows):
    if not rows:
        return 0
    if DRY_RUN:
        print(f"  [dry-run] would upsert {len(rows)} rows into attribute_grades (source=fbref)")
        return len(rows)
    total = 0
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i:i + CHUNK_SIZE]
        sb_client.table("attribute_grades").upsert(
            chunk, on_conflict="player_id,attribute,source"
        ).execute()
        total += len(chunk)
    return total


# ── FBRef aggregation ─────────────────────────────────────────────────────────

def aggregate_fbref(cur):
    print("\n── FBRef → Attribute Grades ───────────────────────────────────────")

    # Load player positions
    print("  Loading player positions...")
    cur.execute("SELECT person_id, position FROM player_profiles WHERE position IS NOT NULL")
    player_positions = {}
    for pid, pos in cur.fetchall():
        player_positions[pid] = get_position_group(pos)
    print(f"  {len(player_positions)} players with known positions")

    # Determine which season to use
    season_clause = ""
    season_params = [MIN_MINUTES]
    if SEASON:
        season_clause = "AND s.season = %s"
        season_params.append(SEASON)

    # Fetch FBRef stats joined to people via fbref_players
    print("  Fetching FBRef season stats...")
    query = f"""
        SELECT
            fp.person_id,
            s.season,
            s.minutes,
            s.matches_played,
            s.goals,
            s.assists,
            s.shots,
            s.shots_on_target,
            s.xg,
            s.npxg,
            s.xag,
            s.passes_completed,
            s.passes_attempted,
            s.pass_pct,
            s.progressive_passes,
            s.key_passes,
            s.tackles,
            s.tackles_won,
            s.interceptions,
            s.blocks,
            s.clearances,
            s.touches,
            s.carries,
            s.progressive_carries,
            s.successful_dribbles,
            s.dribbles_attempted,
            s.gk_saves,
            s.gk_save_pct,
            s.gk_clean_sheets,
            s.gk_goals_against,
            s.gk_psxg
        FROM fbref_player_season_stats s
        JOIN fbref_players fp ON fp.fbref_id = s.fbref_id
        WHERE fp.person_id IS NOT NULL
          AND s.minutes >= %s
          {season_clause}
        ORDER BY fp.person_id, s.season DESC
    """
    cur.execute(query, season_params)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    print(f"  Qualifying rows (>={MIN_MINUTES} min): {len(rows)}")

    if not rows:
        print("  No qualifying FBRef data found.")
        return 0

    # For each player, use the latest season if multiple exist
    # (first row per person_id due to ORDER BY season DESC)
    seen = set()
    player_data = {}
    for row in rows:
        d = dict(zip(cols, row))
        pid = d["person_id"]
        if pid in seen:
            continue
        seen.add(pid)
        player_data[pid] = d

    print(f"  Unique players (latest season each): {len(player_data)}")

    # Apply position filter if requested
    if POS_FILTER != "all":
        filtered = {}
        for pid, d in player_data.items():
            pg = player_positions.get(pid)
            if pg == POS_FILTER:
                filtered[pid] = d
            elif pg is None and POS_FILTER != "gk":
                filtered[pid] = d  # include unknowns in non-GK filters
        player_data = filtered
        print(f"  After position filter ({POS_FILTER}): {len(player_data)}")

    # ── Compute raw metrics per player ─────────────────────────────────────

    player_metrics = {}
    for pid, d in player_data.items():
        mins = d["minutes"] or 0
        if mins <= 0:
            continue

        m = {}
        pg = player_positions.get(pid)

        # --- Outfield metrics ---
        if pg != "gk":
            # Finishing: goals per 90
            m["finishing"] = _per90(d.get("goals"), mins)

            # Shot accuracy: shots on target / shots
            shots = d.get("shots") or 0
            if shots >= 5:
                m["shot_accuracy"] = _safe((d.get("shots_on_target") or 0) / shots * 100)

            # xG overperformance: (goals - xG) per 90
            xg = d.get("xg")
            goals = d.get("goals") or 0
            if xg is not None:
                m["xg_overperformance"] = _per90(goals - float(xg), mins)

            # Creativity: key passes per 90
            m["creativity"] = _per90(d.get("key_passes"), mins)

            # Vision: xAG per 90
            xag = d.get("xag")
            if xag is not None:
                m["vision"] = _per90(float(xag), mins)

            # Pass accuracy
            pass_pct = d.get("pass_pct")
            if pass_pct is not None:
                m["pass_accuracy"] = _safe(float(pass_pct))

            # Progressive passing per 90
            m["progressive_passing"] = _per90(d.get("progressive_passes"), mins)

            # Tackling: tackles won per 90
            m["tackling"] = _per90(d.get("tackles_won"), mins)

            # Interceptions per 90
            m["interceptions"] = _per90(d.get("interceptions"), mins)

            # Defensive work: (tackles + interceptions) per 90
            tackles = d.get("tackles") or 0
            intercepts = d.get("interceptions") or 0
            m["defensive_work"] = _per90(tackles + intercepts, mins)

            # Blocks + clearances per 90
            blocks = d.get("blocks") or 0
            clearances = d.get("clearances") or 0
            m["blocks_clearances"] = _per90(blocks + clearances, mins)

            # Dribbling: successful / attempted
            drib_att = d.get("dribbles_attempted") or 0
            if drib_att >= 5:
                m["dribbling"] = _safe((d.get("successful_dribbles") or 0) / drib_att * 100)

            # Progressive carrying per 90
            m["progressive_carrying"] = _per90(d.get("progressive_carries"), mins)

            # Composure proxy: pass accuracy under volume
            # (high pass_pct with high pass volume = composure)
            passes_att = d.get("passes_attempted") or 0
            if passes_att >= 50 and pass_pct is not None:
                pass_volume_p90 = passes_att / mins * 90
                m["composure"] = _safe(float(pass_pct) * min(pass_volume_p90 / 50, 1.2))

            # Aerial presence proxy: clearances per 90 (best available from FBRef standard stats)
            if clearances >= 3:
                m["aerial_presence"] = _per90(clearances, mins)

        # --- GK metrics ---
        if pg == "gk" or (pg is None and (d.get("gk_saves") or 0) > 0):
            gk_saves = d.get("gk_saves") or 0
            gk_save_pct = d.get("gk_save_pct")
            gk_cs = d.get("gk_clean_sheets") or 0
            gk_ga = d.get("gk_goals_against") or 0
            gk_psxg = d.get("gk_psxg")
            matches = d.get("matches_played") or 1

            if gk_save_pct is not None:
                m["gk_saves_rate"] = _safe(float(gk_save_pct))

            if matches >= 3:
                m["gk_clean_sheet_rate"] = _safe(gk_cs / matches * 100)

            # Shot-stopping: goals prevented vs post-shot xG
            if gk_psxg is not None and gk_ga is not None:
                m["gk_shot_stopping"] = _per90(float(gk_psxg) - gk_ga, mins)

        # Filter out Nones
        player_metrics[pid] = {k: v for k, v in m.items() if v is not None}

    print(f"  Players with computed metrics: {len(player_metrics)}")

    # ── Position-aware percentile scoring ──────────────────────────────────

    scores = compute_positional_percentiles(player_metrics, player_positions)

    # ── Build upsert rows ──────────────────────────────────────────────────

    now_iso = datetime.now(timezone.utc).isoformat()
    upsert_rows = []
    for pid, metric_scores in scores.items():
        for attr, score in metric_scores.items():
            upsert_rows.append({
                "player_id": pid,
                "attribute": attr,
                "stat_score": score,
                "source": "fbref",
                "is_inferred": True,
                "confidence": "Medium",
                "updated_at": now_iso,
            })

    print(f"  Attribute scores computed: {len(upsert_rows)} for {len(scores)} players")

    # Show sample
    if upsert_rows:
        sample_pid = next(iter(scores))
        sample_name = player_data.get(sample_pid, {}).get("season", "?")
        print(f"\n  Sample (person_id={sample_pid}, season={sample_name}):")
        for attr, sc in sorted(scores[sample_pid].items()):
            raw = player_metrics.get(sample_pid, {}).get(attr, "?")
            if isinstance(raw, float):
                raw = f"{raw:.2f}"
            print(f"    {attr:25s}  raw={raw:>8s}  score={sc:2d}/20")

    # ── Upsert ─────────────────────────────────────────────────────────────

    n = chunked_upsert(upsert_rows)
    print(f"\n  Upserted: {n}")
    return n


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("FBRef → Attribute Grades Builder")
    print(f"  Season:      {SEASON or 'latest available'}")
    print(f"  Position:    {POS_FILTER}")
    print(f"  Min minutes: {MIN_MINUTES}")
    print(f"  Dry run:     {DRY_RUN}")
    print(f"  Force:       {FORCE}")

    cur = conn.cursor()
    total = aggregate_fbref(cur)

    print("\n── Summary ───────────────────────────────────────────────────────")
    print(f"  fbref: {total} attribute scores")
    if DRY_RUN:
        print("  (dry-run — no data was written)")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
