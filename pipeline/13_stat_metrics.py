"""
13_stat_metrics.py — Aggregate StatsBomb events + Understat xG into per-player
attribute scores, writing results to `attribute_grades`.

Usage:
    python 13_stat_metrics.py                        # all sources
    python 13_stat_metrics.py --source understat      # Understat only
    python 13_stat_metrics.py --source statsbomb      # StatsBomb only
    python 13_stat_metrics.py --dry-run               # preview without writing
    python 13_stat_metrics.py --min-matches 10        # require 10+ qualifying matches
    python 13_stat_metrics.py --force                 # overwrite existing rows
"""
import argparse
import math
import sys
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
from supabase import create_client

from config import POSTGRES_DSN, SUPABASE_URL, SUPABASE_SERVICE_KEY

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Build stat-based attribute grades from match data")
parser.add_argument("--source", choices=["understat", "statsbomb", "all"], default="all",
                    help="Which data source to aggregate (default: all)")
parser.add_argument("--min-matches", type=int, default=5,
                    help="Minimum qualifying matches for a player to be included (default: 5)")
parser.add_argument("--dry-run", action="store_true",
                    help="Print summaries without writing to database")
parser.add_argument("--force", action="store_true",
                    help="Overwrite existing stat_score values for these sources")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
MIN_MATCHES = args.min_matches
SOURCE = args.source
CHUNK_SIZE = 200

# ── Connections ────────────────────────────────────────────────────────────────

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
# GK skipped — not enough GK-specific events

# Which metrics are relevant per position group
ATTACKER_METRICS = {
    "movement", "close_range", "creativity", "vision", "reactions",
    "intensity", "anticipation", "tempo", "positioning", "takeons",
    "carries", "through_balls",
}
MIDFIELDER_METRICS = {
    "pass_accuracy", "pass_range", "through_balls", "creativity", "vision",
    "pressing", "interceptions", "anticipation", "tempo", "composure",
    "carries", "tackling",
}
DEFENDER_METRICS = {
    "pressing", "tackling", "aerial_duels", "interceptions", "pass_accuracy",
    "pass_range", "composure",
}


def get_position_group(position):
    """Return position group string or None for GK/unknown."""
    if position in ATTACKER_POS:
        return "attacker"
    if position in MIDFIELDER_POS:
        return "midfielder"
    if position in DEFENDER_POS:
        return "defender"
    return None


def metric_relevant(metric, pos_group):
    """Check if a metric is relevant for this position group."""
    if pos_group is None:
        return True  # unknown position — include all
    if pos_group == "attacker":
        return metric in ATTACKER_METRICS
    if pos_group == "midfielder":
        return metric in MIDFIELDER_METRICS
    if pos_group == "defender":
        return metric in DEFENDER_METRICS
    return True


# ── Helpers ────────────────────────────────────────────────────────────────────

def _safe(val):
    """Convert NaN/inf to None."""
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val


def percentile_rank(values):
    """Return dict mapping index→percentile (0-100) for a list of (index, value) pairs."""
    sorted_vals = sorted(values, key=lambda x: x[1])
    n = len(sorted_vals)
    if n == 0:
        return {}
    ranks = {}
    for rank_pos, (idx, _val) in enumerate(sorted_vals):
        ranks[idx] = (rank_pos / max(n - 1, 1)) * 100
    return ranks


def percentile_to_score(pct):
    """Convert percentile (0-100) to 1-10 scale."""
    return max(1, min(10, round(pct / 10)))


def compute_positional_percentiles(player_metrics, player_positions):
    """
    Given {person_id: {metric: raw_value}} and {person_id: position_group},
    compute percentile ranks within position groups.
    Returns {person_id: {metric: score_1_20}}.
    """
    # Collect all metrics across all players
    all_metrics = set()
    for metrics in player_metrics.values():
        all_metrics.update(metrics.keys())

    # Group players by position group
    groups = {}  # pos_group -> [person_id]
    for pid, pg in player_positions.items():
        groups.setdefault(pg or "unknown", []).append(pid)

    results = {}  # person_id -> {metric: score}

    for metric in all_metrics:
        for group_name, pids in groups.items():
            # Collect (person_id, value) for players in this group who have this metric
            vals = []
            for pid in pids:
                v = player_metrics.get(pid, {}).get(metric)
                if v is not None:
                    vals.append((pid, v))

            if len(vals) < 3:
                continue  # too few players for meaningful percentiles

            pct_ranks = percentile_rank(vals)
            for pid, pct in pct_ranks.items():
                if not metric_relevant(metric, group_name if group_name != "unknown" else None):
                    continue
                results.setdefault(pid, {})[metric] = percentile_to_score(pct)

    return results


def load_player_positions(cur):
    """Load person_id → position_group mapping from player_profiles."""
    cur.execute("SELECT person_id, position FROM player_profiles WHERE position IS NOT NULL")
    positions = {}
    for pid, pos in cur.fetchall():
        positions[pid] = get_position_group(pos)
    return positions


def chunked_upsert(rows, source_name):
    """Upsert attribute_grades rows via Supabase client."""
    if not rows:
        return 0
    if DRY_RUN:
        print(f"  [dry-run] would upsert {len(rows)} rows into attribute_grades (source={source_name})")
        return len(rows)
    total = 0
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i:i + CHUNK_SIZE]
        sb_client.table("attribute_grades").upsert(
            chunk, on_conflict="player_id,attribute,source"
        ).execute()
        total += len(chunk)
    return total


# ── Understat aggregation ─────────────────────────────────────────────────────

def aggregate_understat(cur, player_positions):
    """Aggregate Understat xG data into attribute grades."""
    print("\n── Understat Aggregation ──────────────────────────────────────────")

    # Single query: aggregate all linked understat players
    cur.execute("""
        SELECT
            pil.person_id,
            COUNT(*)                             AS matches,
            SUM(COALESCE(ups.time, 0))           AS total_minutes,
            SUM(COALESCE(ups.xg, 0))             AS sum_xg,
            SUM(COALESCE(ups.xa, 0))             AS sum_xa,
            SUM(COALESCE(ups.goals, 0))          AS sum_goals,
            SUM(COALESCE(ups.shots, 0))          AS sum_shots,
            SUM(COALESCE(ups.key_passes, 0))     AS sum_key_passes,
            SUM(COALESCE(ups.npg, 0))            AS sum_npg,
            SUM(COALESCE(ups.npxa, 0))           AS sum_npxa,
            SUM(COALESCE(ups.xgchain, 0))        AS sum_xgchain,
            SUM(COALESCE(ups.xgbuildup, 0))      AS sum_xgbuildup
        FROM player_id_links pil
        JOIN understat_player_match_stats ups
            ON ups.player_id = CAST(pil.external_id AS INTEGER)
        WHERE pil.source = 'understat'
          AND ups.time >= 15
        GROUP BY pil.person_id
        HAVING COUNT(*) >= %s
    """, (MIN_MATCHES,))

    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    print(f"  Players with {MIN_MATCHES}+ qualifying matches: {len(rows)}")

    if not rows:
        return 0

    # Build per-player raw metrics
    player_metrics = {}
    for row in rows:
        d = dict(zip(cols, row))
        pid = d["person_id"]
        mins = max(d["total_minutes"], 1)
        matches = d["matches"]

        player_metrics[pid] = {
            "movement":     _safe(d["sum_xg"] / mins * 90),
            "close_range":  _safe(d["sum_goals"] / mins * 90),
            "creativity":   _safe(d["sum_xa"] / mins * 90),
            "vision":       _safe(d["sum_key_passes"] / mins * 90),
            "reactions":    _safe((d["sum_goals"] - d["sum_xg"]) / matches),
            "intensity":    _safe(d["sum_shots"] / mins * 90),
            "anticipation": _safe(d["sum_xgchain"] / mins * 90),
            "tempo":        _safe(d["sum_xgbuildup"] / mins * 90),
        }

    # Position-aware percentile scoring
    scores = compute_positional_percentiles(player_metrics, player_positions)

    # Build upsert rows
    now_iso = datetime.now(timezone.utc).isoformat()
    upsert_rows = []
    for pid, metric_scores in scores.items():
        for attr, score in metric_scores.items():
            upsert_rows.append({
                "player_id": pid,
                "attribute": attr,
                "stat_score": score,
                "source": "understat",
                "is_inferred": True,
                "confidence": "Medium",
                "updated_at": now_iso,
            })

    print(f"  Metrics computed: {len(upsert_rows)} attribute scores for {len(scores)} players")
    n = chunked_upsert(upsert_rows, "understat")
    print(f"  Upserted: {n}")
    return n


# ── StatsBomb aggregation ─────────────────────────────────────────────────────

def aggregate_statsbomb(cur, player_positions):
    """Aggregate StatsBomb event data into attribute grades."""
    print("\n── StatsBomb Aggregation ──────────────────────────────────────────")

    # Build temp mapping: sb_player_id (float string from events) → person_id
    # This avoids repeated CAST on 3.25M rows in every query.
    print("  Building SB player mapping...")
    cur.execute("""
        CREATE TEMP TABLE IF NOT EXISTS sb_player_map AS
        SELECT pil.person_id,
               pil.external_id,
               pil.external_id || '.0' AS sb_player_id_str
        FROM player_id_links pil
        WHERE pil.source = 'statsbomb'
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sb_map ON sb_player_map(sb_player_id_str)")

    # Step 1: Get matches played per SB-linked player
    print("  Counting matches per player...")
    cur.execute("""
        SELECT m.person_id,
               COUNT(DISTINCT e.match_id) AS matches
        FROM sb_player_map m
        JOIN sb_events e
            ON e.raw->>'player_id' = m.sb_player_id_str
        GROUP BY m.person_id
        HAVING COUNT(DISTINCT e.match_id) >= %s
    """, (MIN_MATCHES,))
    eligible = {r[0]: r[1] for r in cur.fetchall()}
    print(f"  Players with {MIN_MATCHES}+ matches: {len(eligible)}")

    if not eligible:
        return 0

    eligible_pids = list(eligible.keys())

    # Step 2: Aggregate passing metrics
    print("  Aggregating passes...")
    cur.execute("""
        SELECT m.person_id,
               COUNT(*) AS total_passes,
               COUNT(*) FILTER (WHERE e.raw->>'pass_outcome' IS NULL) AS completed_passes,
               COUNT(*) FILTER (
                   WHERE e.raw->'pass_end_location' IS NOT NULL
                     AND e.location IS NOT NULL
                     AND (e.raw->'pass_end_location'->>0)::float - (e.location[1])::float > 10
               ) AS progressive_passes,
               COUNT(*) FILTER (WHERE e.raw->>'pass_through_ball' IS NOT NULL) AS through_balls
        FROM sb_player_map m
        JOIN sb_events e
            ON e.raw->>'player_id' = m.sb_player_id_str
        WHERE e.type = 'Pass'
          AND m.person_id = ANY(%s)
        GROUP BY m.person_id
    """, (eligible_pids,))
    pass_data = {r[0]: {"total": r[1], "completed": r[2], "progressive": r[3], "through": r[4]}
                 for r in cur.fetchall()}

    # Step 3: Aggregate shooting metrics
    print("  Aggregating shots...")
    cur.execute("""
        SELECT m.person_id,
               COUNT(*) AS total_shots,
               COUNT(*) FILTER (WHERE e.raw->>'shot_outcome' = 'Goal') AS goals,
               AVG(NULLIF((e.raw->>'shot_statsbomb_xg')::float, 0)) AS avg_xg_per_shot
        FROM sb_player_map m
        JOIN sb_events e
            ON e.raw->>'player_id' = m.sb_player_id_str
        WHERE e.type = 'Shot'
          AND m.person_id = ANY(%s)
        GROUP BY m.person_id
    """, (eligible_pids,))
    shot_data = {r[0]: {"shots": r[1], "goals": r[2], "avg_xg": r[3]} for r in cur.fetchall()}

    # Step 4: Aggregate dribble metrics
    print("  Aggregating dribbles...")
    cur.execute("""
        SELECT m.person_id,
               COUNT(*) AS attempts,
               COUNT(*) FILTER (WHERE e.raw->>'dribble_outcome' = 'Complete') AS successful
        FROM sb_player_map m
        JOIN sb_events e
            ON e.raw->>'player_id' = m.sb_player_id_str
        WHERE e.type = 'Dribble'
          AND m.person_id = ANY(%s)
        GROUP BY m.person_id
    """, (eligible_pids,))
    dribble_data = {r[0]: {"attempts": r[1], "successful": r[2]} for r in cur.fetchall()}

    # Step 5: Aggregate carries (progressive distance)
    print("  Aggregating carries...")
    cur.execute("""
        SELECT m.person_id,
               COUNT(*) AS total_carries,
               COUNT(*) FILTER (
                   WHERE e.raw->'carry_end_location' IS NOT NULL
                     AND e.location IS NOT NULL
                     AND (e.raw->'carry_end_location'->>0)::float - (e.location[1])::float > 10
               ) AS progressive_carries
        FROM sb_player_map m
        JOIN sb_events e
            ON e.raw->>'player_id' = m.sb_player_id_str
        WHERE e.type = 'Carry'
          AND m.person_id = ANY(%s)
        GROUP BY m.person_id
    """, (eligible_pids,))
    carry_data = {r[0]: {"total": r[1], "progressive": r[2]} for r in cur.fetchall()}

    # Step 6: Aggregate defensive metrics (pressures + ball recoveries)
    print("  Aggregating defensive actions...")
    cur.execute("""
        SELECT m.person_id,
               COUNT(*) FILTER (WHERE e.type = 'Pressure') AS pressures,
               COUNT(*) FILTER (WHERE e.type = 'Ball Recovery') AS recoveries
        FROM sb_player_map m
        JOIN sb_events e
            ON e.raw->>'player_id' = m.sb_player_id_str
        WHERE e.type IN ('Pressure', 'Ball Recovery')
          AND m.person_id = ANY(%s)
        GROUP BY m.person_id
    """, (eligible_pids,))
    def_data = {r[0]: {"pressures": r[1], "recoveries": r[2]} for r in cur.fetchall()}

    # Step 7: Aggregate duels (aerial + tackles)
    print("  Aggregating duels...")
    cur.execute("""
        SELECT m.person_id,
               COUNT(*) FILTER (WHERE e.raw->>'duel_type' LIKE 'Aerial%%') AS aerial_total,
               COUNT(*) FILTER (WHERE e.raw->>'duel_type' = 'Aerial Lost') AS aerial_lost,
               COUNT(*) FILTER (WHERE e.raw->>'duel_type' LIKE 'Tackle%%') AS tackles
        FROM sb_player_map m
        JOIN sb_events e
            ON e.raw->>'player_id' = m.sb_player_id_str
        WHERE e.type = 'Duel'
          AND m.person_id = ANY(%s)
        GROUP BY m.person_id
    """, (eligible_pids,))
    duel_data = {r[0]: {"aerial_total": r[1], "aerial_lost": r[2], "tackles": r[3]}
                 for r in cur.fetchall()}

    # Step 8: Under-pressure success rate
    print("  Aggregating under-pressure actions...")
    cur.execute("""
        SELECT m.person_id,
               COUNT(*) AS total_pressured,
               COUNT(*) FILTER (
                   WHERE (e.type = 'Pass' AND e.raw->>'pass_outcome' IS NULL)
                      OR (e.type = 'Dribble' AND e.raw->>'dribble_outcome' = 'Complete')
                      OR (e.type = 'Shot' AND e.raw->>'shot_outcome' = 'Goal')
               ) AS successful_pressured
        FROM sb_player_map m
        JOIN sb_events e
            ON e.raw->>'player_id' = m.sb_player_id_str
        WHERE e.under_pressure = true
          AND e.type IN ('Pass', 'Dribble', 'Shot')
          AND m.person_id = ANY(%s)
        GROUP BY m.person_id
    """, (eligible_pids,))
    pressure_data = {r[0]: {"total": r[1], "successful": r[2]} for r in cur.fetchall()}

    # Step 9: Build per-player raw metrics (per-90 using match count)
    print("  Computing per-90 metrics...")
    player_metrics = {}
    for pid in eligible_pids:
        matches = eligible[pid]
        p90_factor = 90 / (matches * 90)  # approximate: assume 90 mins per match

        m = {}

        # Passing
        pd_ = pass_data.get(pid, {})
        total_p = pd_.get("total", 0)
        if total_p > 0:
            m["pass_accuracy"] = pd_.get("completed", 0) / total_p * 100
        m["pass_range"] = _safe(pd_.get("progressive", 0) * p90_factor)
        m["through_balls"] = _safe(pd_.get("through", 0) * p90_factor)

        # Shooting
        sd = shot_data.get(pid, {})
        if sd.get("avg_xg"):
            m["positioning"] = _safe(sd["avg_xg"])
        if sd.get("shots", 0) > 0:
            m["close_range"] = sd.get("goals", 0) / sd["shots"] * 100

        # Dribbling
        dd = dribble_data.get(pid, {})
        if dd.get("attempts", 0) > 0:
            m["takeons"] = dd.get("successful", 0) / dd["attempts"] * 100

        # Carries
        cd = carry_data.get(pid, {})
        m["carries"] = _safe(cd.get("progressive", 0) * p90_factor)

        # Defending
        defd = def_data.get(pid, {})
        m["pressing"] = _safe(defd.get("pressures", 0) * p90_factor)
        m["interceptions"] = _safe(defd.get("recoveries", 0) * p90_factor)

        # Duels
        dld = duel_data.get(pid, {})
        aerial_total = dld.get("aerial_total", 0)
        aerial_lost = dld.get("aerial_lost", 0)
        if aerial_total > 0:
            m["aerial_duels"] = (aerial_total - aerial_lost) / aerial_total * 100
        m["tackling"] = _safe(dld.get("tackles", 0) * p90_factor)

        # Composure (under pressure success rate)
        prd = pressure_data.get(pid, {})
        if prd.get("total", 0) >= 5:
            m["composure"] = prd["successful"] / prd["total"] * 100

        # Filter out None values
        player_metrics[pid] = {k: v for k, v in m.items() if v is not None}

    # Position-aware percentile scoring
    scores = compute_positional_percentiles(player_metrics, player_positions)

    # Build upsert rows
    now_iso = datetime.now(timezone.utc).isoformat()
    upsert_rows = []
    for pid, metric_scores in scores.items():
        for attr, score in metric_scores.items():
            upsert_rows.append({
                "player_id": pid,
                "attribute": attr,
                "stat_score": score,
                "source": "statsbomb",
                "is_inferred": True,
                "confidence": "Medium",
                "updated_at": now_iso,
            })

    print(f"  Metrics computed: {len(upsert_rows)} attribute scores for {len(scores)} players")
    n = chunked_upsert(upsert_rows, "statsbomb")
    print(f"  Upserted: {n}")
    return n


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"Stat Metrics Builder")
    print(f"  Source: {SOURCE}")
    print(f"  Min matches: {MIN_MATCHES}")
    print(f"  Dry run: {DRY_RUN}")
    print(f"  Force: {FORCE}")

    cur = conn.cursor()

    # Load player positions for position-aware percentiles
    print("\nLoading player positions...")
    player_positions = load_player_positions(cur)
    print(f"  {len(player_positions)} players with known positions")

    totals = {}

    if SOURCE in ("understat", "all"):
        totals["understat"] = aggregate_understat(cur, player_positions)

    if SOURCE in ("statsbomb", "all"):
        totals["statsbomb"] = aggregate_statsbomb(cur, player_positions)

    # Summary
    print("\n── Summary ───────────────────────────────────────────────────────")
    for src, count in totals.items():
        print(f"  {src}: {count} attribute scores")
    if DRY_RUN:
        print("  (dry-run — no data was written)")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
