"""
32_current_level.py — Compute realistic current level for every player.

Adjusts player_profiles.level based on age-decay curves, performance data,
activity status, and scout overrides. Fixes the problem where level = peak
for all players (e.g., 41-year-old Thiago Silva showing as 93).

Algorithm:
  1. Age-based decay from peak (position-specific curves)
  2. Performance adjustment from recent attribute grades
  3. Activity check (retired / unsigned older players)
  4. Scout override (blend scout assessment if available)

Usage:
    python 32_current_level.py                    # recompute where level = peak
    python 32_current_level.py --dry-run          # preview without writing
    python 32_current_level.py --player 123       # single player
    python 32_current_level.py --limit 100        # max 100 players
    python 32_current_level.py --force             # recompute all players with peak data
    python 32_current_level.py --verbose           # show every player, not just big changes
"""
from __future__ import annotations

import argparse
import sys
from datetime import date

from config import POSTGRES_DSN

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Compute realistic current level from peak + age")
parser.add_argument("--player", type=str, default=None,
                    help="Single person_id to process")
parser.add_argument("--limit", type=int, default=None,
                    help="Max players to process (default: all with peak data)")
parser.add_argument("--dry-run", action="store_true",
                    help="Preview without writing to database")
parser.add_argument("--force", action="store_true",
                    help="Re-compute all players (default: only where level = peak or level > age curve)")
parser.add_argument("--verbose", action="store_true",
                    help="Show every player, not just significant changes")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
VERBOSE = args.verbose

# ── Connection ─────────────────────────────────────────────────────────────────

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True

# ── Position-specific age curves ───────────────────────────────────────────────

# (peak_window_start, peak_window_end, decay_per_year)
POSITION_CURVES = {
    "GK": (28, 34, 1.5),
    "CD": (27, 32, 2.0),
    "DM": (27, 32, 2.0),
    "CM": (26, 30, 2.5),
    "WM": (26, 30, 2.5),
    "AM": (26, 30, 2.5),
    "WF": (25, 29, 3.0),
    "WD": (25, 29, 3.0),
    "CF": (25, 29, 3.0),
}

# Default curve for unknown positions
DEFAULT_CURVE = (26, 30, 2.5)

# Age at which decay accelerates (+0.5/yr on top of base decay)
CLIFF_AGE = 35

# Minimum level floor as fraction of peak
FLOOR_FRACTION = 0.50

# Growth base (16-year-old plays at this fraction of peak)
GROWTH_BASE = 0.60


def compute_age(dob: date) -> float:
    """Compute age in years (fractional) from date of birth."""
    today = date.today()
    age = today.year - dob.year
    # Adjust if birthday hasn't occurred yet this year
    if (today.month, today.day) < (dob.month, dob.day):
        age -= 1
    return age


def age_curve_level(peak: int, age: int, position: str) -> float:
    """Compute level from peak based on age and position curve."""
    peak_start, peak_end, decay_rate = POSITION_CURVES.get(position, DEFAULT_CURVE)
    floor = peak * FLOOR_FRACTION

    if age < 16:
        # Too young — use growth base
        return peak * GROWTH_BASE

    if age < peak_start:
        # Growth phase: linearly from 60% at 16 to 100% at peak_start
        growth_range = peak_start - 16
        if growth_range <= 0:
            return float(peak)
        progress = (age - 16) / growth_range
        level = peak * (GROWTH_BASE + (1.0 - GROWTH_BASE) * progress)
        return min(level, float(peak))

    if age <= peak_end:
        # Peak window — no decay
        return float(peak)

    # After peak window — decay
    years_past = age - peak_end
    total_decay = 0.0
    for yr in range(1, years_past + 1):
        yr_age = peak_end + yr
        extra = 0.5 * max(0, yr_age - CLIFF_AGE) if yr_age > CLIFF_AGE else 0.0
        total_decay += decay_rate + extra

    level = peak - total_decay
    return max(level, floor)


def performance_adjustment(avg_stat_score: float, age_level: float) -> float:
    """
    Adjust level based on recent performance data.

    If avg_stat_score > age_level * 0.8: boost up to +3
    If avg_stat_score < age_level * 0.5: reduce up to -3
    Scale proportionally within bounds.
    """
    if age_level <= 0:
        return 0.0

    high_threshold = age_level * 0.80
    low_threshold = age_level * 0.50
    midpoint = (high_threshold + low_threshold) / 2

    if avg_stat_score >= high_threshold:
        # Over-performing: scale 0 to +3
        # How far above the threshold vs a reasonable max
        overshoot = avg_stat_score - high_threshold
        max_overshoot = age_level - high_threshold  # theoretical max above threshold
        if max_overshoot <= 0:
            return 3.0
        ratio = min(overshoot / max_overshoot, 1.0)
        return ratio * 3.0

    if avg_stat_score <= low_threshold:
        # Under-performing: scale 0 to -3
        undershoot = low_threshold - avg_stat_score
        max_undershoot = low_threshold  # theoretical max below threshold
        if max_undershoot <= 0:
            return -3.0
        ratio = min(undershoot / max_undershoot, 1.0)
        return -ratio * 3.0

    # Between thresholds — proportional adjustment from -3 to +3
    if avg_stat_score >= midpoint:
        ratio = (avg_stat_score - midpoint) / (high_threshold - midpoint)
        return ratio * 3.0 * 0.5  # Smaller adjustment in the middle zone
    else:
        ratio = (midpoint - avg_stat_score) / (midpoint - low_threshold)
        return -ratio * 3.0 * 0.5

    return 0.0


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Current Level Calculator")
    print(f"  Dry run:  {DRY_RUN}")
    print(f"  Force:    {FORCE}")
    print(f"  Verbose:  {VERBOSE}")

    cur = conn.cursor()

    # ── Step 1: Fetch players with peak data ──────────────────────────────────

    where_clauses = ["pp.peak IS NOT NULL"]
    params = []

    if args.player:
        where_clauses.append("p.id = %s")
        params.append(int(args.player))

    if not FORCE:
        # Only recompute where level = peak or level is NULL or level > age curve
        where_clauses.append("(pp.level IS NULL OR pp.level = pp.peak)")

    where_sql = "WHERE " + " AND ".join(where_clauses)
    limit_sql = f"LIMIT {args.limit}" if args.limit else ""

    print("\n  Loading players...")
    cur.execute(f"""
        SELECT p.id, p.name, p.date_of_birth, p.active,
               pp.position, pp.level, pp.peak,
               ps.contract_tag
        FROM people p
        JOIN player_profiles pp ON pp.person_id = p.id
        LEFT JOIN player_status ps ON ps.person_id = p.id
        {where_sql}
        ORDER BY pp.peak DESC
        {limit_sql}
    """, params)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    players = [dict(zip(cols, row)) for row in rows]
    print(f"  Players to process: {len(players)}")

    if not players:
        print("  Nothing to do.")
        cur.close()
        conn.close()
        return

    # ── Step 2: Fetch performance data (stat_scores from real sources) ────────

    player_ids = [p["id"] for p in players]

    print("  Loading attribute grades...")
    # Batch fetch in chunks to avoid huge IN clauses
    perf_data = {}  # player_id -> avg stat_score
    scout_data = {}  # player_id -> avg scout_grade (1-20)
    chunk_size = 500

    for i in range(0, len(player_ids), chunk_size):
        chunk = player_ids[i:i + chunk_size]
        placeholders = ",".join(["%s"] * len(chunk))

        # Performance data from real sources
        cur.execute(f"""
            SELECT player_id,
                   AVG(stat_score) as avg_stat_score,
                   COUNT(*) as attr_count
            FROM attribute_grades
            WHERE player_id IN ({placeholders})
              AND source IN ('understat', 'statsbomb', 'computed', 'fbref')
              AND stat_score IS NOT NULL
              AND stat_score > 0
            GROUP BY player_id
        """, chunk)
        for row in cur.fetchall():
            perf_data[row[0]] = float(row[1])

        # Scout assessment data
        cur.execute(f"""
            SELECT player_id,
                   AVG(scout_grade) as avg_scout_grade,
                   COUNT(*) as attr_count
            FROM attribute_grades
            WHERE player_id IN ({placeholders})
              AND source = 'scout_assessment'
              AND scout_grade IS NOT NULL
              AND scout_grade > 0
            GROUP BY player_id
        """, chunk)
        for row in cur.fetchall():
            scout_data[row[0]] = float(row[1])

    print(f"  Players with performance data: {len(perf_data)}")
    print(f"  Players with scout grades: {len(scout_data)}")

    # ── Step 3: Compute current levels ────────────────────────────────────────

    results = []
    stats = {
        "processed": 0,
        "updated": 0,
        "unchanged": 0,
        "skipped_no_dob": 0,
        "skipped_no_position": 0,
        "total_change": 0.0,
        "biggest_drop_name": None,
        "biggest_drop_old": 0,
        "biggest_drop_new": 0,
        "biggest_drop_val": 0,
    }

    today = date.today()

    for idx, p in enumerate(players):
        pid = p["id"]
        name = p["name"]
        dob = p["date_of_birth"]
        peak = p["peak"]
        old_level = p["level"] if p["level"] is not None else peak
        position = p["position"]
        active = p["active"] if p["active"] is not None else True
        contract_tag = p["contract_tag"] or ""

        if dob is None:
            stats["skipped_no_dob"] += 1
            continue

        if position is None:
            stats["skipped_no_position"] += 1
            continue

        age = compute_age(dob)

        # Step 1: Age curve
        peak_start = POSITION_CURVES.get(position, DEFAULT_CURVE)[0]
        curve_level = age_curve_level(peak, age, position)

        # Step 2: Performance adjustment
        # Uses percentile rank among peers — stat_score distributions vary wildly
        # across sources (computed avg=4, statsbomb avg=10, understat avg=5 on 1-20 scale)
        # so we compare each player's avg to the overall median for their data sources.
        perf_adj = 0.0
        avg_stat = perf_data.get(pid)
        if avg_stat is not None and avg_stat > 0:
            # Compare to population median (~5.0 on 1-20 scale across sources)
            # Top performers (>12) get a boost, low (<3) get a penalty
            if avg_stat >= 12.0:
                perf_adj = min((avg_stat - 12.0) / 8.0 * 3.0, 3.0)
            elif avg_stat <= 3.0:
                perf_adj = max((avg_stat - 3.0) / 3.0 * 3.0, -3.0)

        # Step 3: Activity check
        activity_adj = 0.0
        if not active:
            activity_adj = -5.0
        elif "free agent" in contract_tag.lower() and age > 33:
            activity_adj = -2.0

        # Step 4: Scout adjustment (mild — scout grades top out at ~14/20, not well calibrated)
        scout_adj = 0.0
        scout_avg = scout_data.get(pid)
        if scout_avg is not None and scout_avg > 0:
            # Use scout grades as a relative adjustment rather than absolute level
            # Median scout grade is ~11. Above = boost, below = penalty. Max ±4.
            median_scout = 11.0
            scout_adj = (scout_avg - median_scout) * 1.5  # ±4.5 max
            scout_adj = max(-4.0, min(4.0, scout_adj))
        age_adjusted = curve_level + perf_adj + activity_adj + scout_adj

        if old_level == peak or old_level > peak:
            # Broken case: level was never decayed from peak. Use pure age curve.
            new_level = age_adjusted
        elif age < peak_start:
            # Young player with EAFC rating — trust EAFC more (they're tracking
            # actual current ability, not projecting peak)
            # 80% EAFC, 20% age curve
            new_level = old_level * 0.8 + age_adjusted * 0.2
        else:
            # Mature/aging player with EAFC current rating below peak — real data.
            # Blend: 60% EAFC, 40% age curve. Respects EAFC's assessment
            # while applying age decay pressure.
            new_level = old_level * 0.6 + age_adjusted * 0.4

        # Clamp
        floor = peak * FLOOR_FRACTION
        new_level = max(new_level, floor)
        new_level = min(new_level, float(peak))
        new_level = round(new_level)
        new_level = max(1, new_level)  # absolute minimum

        stats["processed"] += 1
        change = new_level - old_level
        significant = abs(change) >= 3

        if new_level != old_level:
            stats["updated"] += 1
            stats["total_change"] += change

            # Track biggest drop
            if change < stats["biggest_drop_val"]:
                stats["biggest_drop_val"] = change
                stats["biggest_drop_name"] = name
                stats["biggest_drop_old"] = old_level
                stats["biggest_drop_new"] = new_level
        else:
            stats["unchanged"] += 1

        if VERBOSE or significant:
            print(f"  [{idx+1}/{len(players)}] {name} ({position}, age {age}) "
                  f"peak={peak} old_level={old_level} -> new_level={new_level} "
                  f"(curve={curve_level:.0f}, perf={perf_adj:+.1f}, "
                  f"act={activity_adj:+.1f}, scout={scout_adj:+.1f})")

        if new_level != old_level:
            results.append({
                "person_id": pid,
                "level": new_level,
            })

    # ── Step 4: Write ─────────────────────────────────────────────────────────

    if not DRY_RUN and results:
        print(f"\n  Writing {len(results)} updates...")
        batch_size = 100
        for i in range(0, len(results), batch_size):
            batch = results[i:i + batch_size]
            for r in batch:
                cur.execute(
                    "UPDATE player_profiles SET level = %s WHERE person_id = %s",
                    (r["level"], r["person_id"])
                )
            if (i + batch_size) % 500 == 0 or i + batch_size >= len(results):
                print(f"    Written {min(i + batch_size, len(results))}/{len(results)}")
    elif DRY_RUN and results:
        print(f"\n  [dry-run] Would update {len(results)} player_profiles.level values")

    # ── Summary ───────────────────────────────────────────────────────────────

    print(f"\n=== Summary ===")
    print(f"  Processed:     {stats['processed']}")
    print(f"  Updated:       {stats['updated']}")
    avg_change = stats["total_change"] / stats["updated"] if stats["updated"] > 0 else 0
    print(f"  Avg change:    {avg_change:+.1f}")
    if stats["biggest_drop_name"]:
        print(f"  Biggest drop:  {stats['biggest_drop_name']} "
              f"({stats['biggest_drop_old']} -> {stats['biggest_drop_new']})")
    print(f"  Unchanged:     {stats['unchanged']}")
    if stats["skipped_no_dob"] > 0:
        print(f"  Skipped (no DOB):      {stats['skipped_no_dob']}")
    if stats["skipped_no_position"] > 0:
        print(f"  Skipped (no position): {stats['skipped_no_position']}")
    if DRY_RUN:
        print("  (dry-run — no data was written)")

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
