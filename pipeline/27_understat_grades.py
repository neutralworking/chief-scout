"""
27_understat_grades.py — Derive attribute_grades from Understat per-match stats.

Maps Understat xG/xA/key_passes/shots/xGChain/xGBuildup to SACROSANCT model
attributes using percentile-based normalization (0-10 scale).

Only processes players with 900+ minutes to ensure statistical reliability.
Writes to attribute_grades with source='understat'.

Usage:
    python pipeline/27_understat_grades.py [--dry-run] [--min-minutes 900]
"""
from __future__ import annotations

import sys
from config import POSTGRES_DSN

DRY_RUN = "--dry-run" in sys.argv
MIN_MINUTES = 900
for arg in sys.argv:
    if arg.startswith("--min-minutes"):
        MIN_MINUTES = int(sys.argv[sys.argv.index(arg) + 1])


# Percentile boundaries from Understat data (3,890 players, 900+ mins)
# Used to normalize per-90 stats to 0-10 scale
# p10 = score 1, p50 = score 5, p90 = score 9, p99 = score 10
PERCENTILES = {
    "xg_p90":      {"p10": 0.009, "p50": 0.072, "p90": 0.346, "p99": 0.60},
    "xa_p90":      {"p10": 0.006, "p50": 0.074, "p90": 0.193, "p99": 0.30},
    "kp_p90":      {"p10": 0.106, "p50": 0.804, "p90": 1.698, "p99": 2.50},
    "shots_p90":   {"p10": 0.184, "p50": 0.885, "p90": 2.556, "p99": 4.50},
    "chain_p90":   {"p10": 0.050, "p50": 0.315, "p90": 0.599, "p99": 0.80},
    "buildup_p90": {"p10": 0.030, "p50": 0.178, "p90": 0.336, "p99": 0.50},
    "goals_p90":   {"p10": 0.000, "p50": 0.050, "p90": 0.300, "p99": 0.55},
    "assists_p90": {"p10": 0.000, "p50": 0.050, "p90": 0.170, "p99": 0.30},
    "npxg_p90":    {"p10": 0.005, "p50": 0.060, "p90": 0.300, "p99": 0.55},
}


def percentile_to_score(value: float, metric: str) -> float:
    """Convert a per-90 stat to 0-10 scale using percentile interpolation."""
    pcts = PERCENTILES.get(metric)
    if not pcts:
        return 5.0
    p10, p50, p90, p99 = pcts["p10"], pcts["p50"], pcts["p90"], pcts["p99"]

    if value <= p10:
        return max(0, 1.0 * (value / p10) if p10 > 0 else 0)
    elif value <= p50:
        return 1.0 + 4.0 * (value - p10) / (p50 - p10)
    elif value <= p90:
        return 5.0 + 4.0 * (value - p50) / (p90 - p50)
    elif value <= p99:
        return 9.0 + 1.0 * (value - p90) / (p99 - p90)
    else:
        return 10.0


# Map Understat aggregates → attribute_grades entries
# Each entry: (attribute_name, understat_metric, weight)
# Some model attributes get scores from multiple Understat metrics (blended)
UNDERSTAT_TO_ATTRIBUTES = {
    # Striker model: close_range, mid_range, long_range, penalties
    "close_range":  [("xg_p90", 0.6), ("goals_p90", 0.4)],
    "mid_range":    [("shots_p90", 0.5), ("xg_p90", 0.5)],
    "long_range":   [("shots_p90", 0.7), ("goals_p90", 0.3)],

    # Creator model: creativity, vision, unpredictability
    "creativity":   [("xa_p90", 0.5), ("kp_p90", 0.5)],
    "vision":       [("xa_p90", 0.4), ("kp_p90", 0.4), ("chain_p90", 0.2)],

    # Passer model: pass_accuracy, through_balls
    "through_balls": [("xa_p90", 0.5), ("kp_p90", 0.5)],

    # Engine model: intensity, pressing
    "intensity":    [("chain_p90", 0.5), ("buildup_p90", 0.5)],

    # Dribbler model: carries, skills
    "carries":      [("chain_p90", 0.4), ("buildup_p90", 0.3), ("npxg_p90", 0.3)],

    # Cover/tactical: awareness, positioning (from buildup involvement)
    "awareness":    [("buildup_p90", 0.6), ("chain_p90", 0.4)],
}


def main():
    import psycopg2
    import psycopg2.extras
    from psycopg2.extras import execute_values

    print("27 — Understat → Attribute Grades")
    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Aggregate Understat per-90 stats for matched players
    print(f"Aggregating Understat stats (min {MIN_MINUTES} mins)...")
    cur.execute("""
        SELECT
            pil.person_id,
            p.name,
            sum(upms.time::numeric) as total_mins,
            sum(upms.xg::numeric) as total_xg,
            sum(upms.xa::numeric) as total_xa,
            sum(upms.key_passes::numeric) as total_kp,
            sum(upms.shots::numeric) as total_shots,
            sum(upms.goals::numeric) as total_goals,
            sum(upms.assists::numeric) as total_assists,
            sum(upms.xgchain::numeric) as total_chain,
            sum(upms.xgbuildup::numeric) as total_buildup,
            sum(upms.npg::numeric) as total_npg,
            sum(CASE WHEN upms.xg::numeric > 0
                THEN upms.xg::numeric - (upms.xg::numeric - (upms.goals::numeric - upms.npg::numeric) * upms.xg::numeric / NULLIF(upms.goals::numeric,0))
                ELSE 0 END) as total_npxg_approx
        FROM player_id_links pil
        JOIN understat_player_match_stats upms ON upms.player_id::text = pil.external_id
        JOIN people p ON p.id = pil.person_id
        WHERE pil.source = 'understat' AND upms.time > 0
        GROUP BY pil.person_id, p.name
        HAVING sum(upms.time::numeric) >= %s
    """, (MIN_MINUTES,))
    players = cur.fetchall()
    print(f"  {len(players):,} players with {MIN_MINUTES}+ minutes")

    # Build attribute grades
    grades_to_write: list[tuple] = []  # (player_id, attribute, stat_score)

    for p in players:
        mins = float(p["total_mins"])
        if mins <= 0:
            continue

        # Compute per-90 stats
        per90 = {
            "xg_p90": float(p["total_xg"]) / mins * 90,
            "xa_p90": float(p["total_xa"]) / mins * 90,
            "kp_p90": float(p["total_kp"]) / mins * 90,
            "shots_p90": float(p["total_shots"]) / mins * 90,
            "goals_p90": float(p["total_goals"]) / mins * 90,
            "assists_p90": float(p["total_assists"]) / mins * 90,
            "chain_p90": float(p["total_chain"]) / mins * 90,
            "buildup_p90": float(p["total_buildup"]) / mins * 90,
            "npxg_p90": float(p["total_xg"]) / mins * 90,  # approximate
        }

        # Convert each attribute
        for attr, metric_weights in UNDERSTAT_TO_ATTRIBUTES.items():
            score = 0.0
            for metric, weight in metric_weights:
                score += percentile_to_score(per90.get(metric, 0), metric) * weight
            # Round to nearest 0.5 and clamp to 1-10 (DB constraint: stat_score >= 1)
            score = max(1, min(10, round(score * 2) / 2))
            grades_to_write.append((p["person_id"], attr, score))

    print(f"  {len(grades_to_write):,} attribute grades to write")

    if DRY_RUN:
        # Show sample
        sample_pid = players[0]["person_id"] if players else None
        if sample_pid:
            print(f"\n  Sample ({players[0]['name']}):")
            for pid, attr, score in grades_to_write:
                if pid == sample_pid:
                    print(f"    {attr:<20} {score:>4}")
        print("\n--dry-run: no writes.")
        conn.rollback()
        conn.close()
        return

    # Delete existing understat-sourced grades and write new ones
    print("  Clearing old understat grades...")
    cur.execute("DELETE FROM attribute_grades WHERE source = 'understat'")
    deleted = cur.rowcount
    print(f"  Deleted {deleted:,} old rows")

    print("  Writing new grades...")
    BATCH = 2000
    for i in range(0, len(grades_to_write), BATCH):
        batch = grades_to_write[i:i + BATCH]
        execute_values(cur, """
            INSERT INTO attribute_grades (player_id, attribute, stat_score, source)
            VALUES %s
            ON CONFLICT (player_id, attribute, source) DO UPDATE SET
                stat_score = EXCLUDED.stat_score
        """, [(pid, attr, score, "understat") for pid, attr, score in batch])
        done = min(i + BATCH, len(grades_to_write))
        print(f"  {done:,}/{len(grades_to_write):,}", end="\r")

    conn.commit()
    print(f"\nDone. {len(grades_to_write):,} grades written for {len(players):,} players.")
    conn.close()


if __name__ == "__main__":
    main()
