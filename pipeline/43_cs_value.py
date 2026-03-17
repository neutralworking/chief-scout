"""
31_cs_value.py — Compute Chief Scout Value (CS Value) for players.

CS Value is our independent transfer valuation: what a club would need to pay
to sign this player today, factoring in age curve, level, positional scarcity,
career trajectory, and Transfermarkt anchor where available.

Formula:
  1. Base value from level → exponential curve (level is the strongest signal)
  2. Age modifier: youth premium, peak neutral, decline discount
  3. TM anchor: blend with Transfermarkt when available (sanity check)
  4. Scarcity modifier: rare positions at high levels get premium
  5. Trajectory modifier: rising players get premium, declining get discount

Outputs:
  - Updates player_market.director_valuation_meur (integer, millions EUR)

Usage:
    python 31_cs_value.py                    # all players with level data
    python 31_cs_value.py --player 123       # single player
    python 31_cs_value.py --limit 100        # first 100
    python 31_cs_value.py --dry-run          # preview without writing
    python 31_cs_value.py --force            # overwrite existing values
"""
import argparse
import math
import sys
from datetime import date

from supabase import create_client

from config import POSTGRES_DSN, SUPABASE_URL, SUPABASE_SERVICE_KEY

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Compute CS Value for players")
parser.add_argument("--player", type=str, default=None,
                    help="Single person_id to process")
parser.add_argument("--limit", type=int, default=None,
                    help="Max players to process")
parser.add_argument("--dry-run", action="store_true",
                    help="Print summaries without writing to database")
parser.add_argument("--force", action="store_true",
                    help="Overwrite existing values")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force

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
sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── Constants ──────────────────────────────────────────────────────────────────

# Level → base value curve (millions EUR)
# Exponential: elite players are worth exponentially more
# Calibrated against known values:
#   93 → ~200m, 91 → ~150m, 88 → ~80m, 85 → ~40m, 80 → ~10m, 75 → ~3m
def level_to_base_value(level: int) -> float:
    """Convert scouting level (1-99) to base value in millions EUR."""
    if level < 65:
        return 0.1
    if level < 70:
        return 0.5 + (level - 65) * 0.3  # 0.5 - 2.0m
    if level < 75:
        return 2.0 + (level - 70) * 0.6  # 2.0 - 5.0m
    if level < 80:
        return 5.0 + (level - 75) * 2.0  # 5.0 - 15.0m
    if level < 85:
        return 15.0 + (level - 80) * 6.0  # 15.0 - 45.0m
    if level < 90:
        return 45.0 + (level - 85) * 15.0  # 45.0 - 120.0m
    # 90+: elite tier, steep curve
    return 120.0 + (level - 90) * 25.0  # 120, 145, 170, 195, 220...


# Age modifier: multiplier on base value
# Peak years are 25-29. Youth gets premium, 30+ gets discount.
def age_modifier(age: int | None) -> float:
    """Return multiplier based on player age."""
    if age is None:
        return 1.0
    if age <= 17:
        return 0.6   # raw potential, unproven
    if age == 18:
        return 0.85
    if age == 19:
        return 1.05
    if age == 20:
        return 1.15
    if age == 21:
        return 1.20
    if age == 22:
        return 1.15
    if age == 23:
        return 1.10
    if age <= 26:
        return 1.0   # peak window
    if age == 27:
        return 0.95
    if age == 28:
        return 0.85
    if age == 29:
        return 0.75
    if age == 30:
        return 0.60
    if age == 31:
        return 0.45
    if age == 32:
        return 0.35
    if age == 33:
        return 0.25
    if age == 34:
        return 0.18
    if age == 35:
        return 0.12
    return 0.08  # 36+


# Positional scarcity: positions with fewer elite players get a premium
POSITION_SCARCITY = {
    "DM": 1.20,   # very thin at elite level
    "WM": 1.15,   # rare position
    "AM": 1.10,   # relatively thin
    "WD": 1.05,   # always in demand
    "CF": 1.00,
    "WF": 1.00,
    "CD": 0.98,   # deepest pool
    "CM": 0.97,   # largest pool
    "GK": 0.85,   # lower transfer fees historically
}


# Trajectory modifier from career_metrics
TRAJECTORY_MODIFIER = {
    "rising": 1.15,
    "peak": 1.0,
    "declining": 0.80,
    "newcomer": 1.10,
    "journeyman": 0.90,
    "one-club": 1.05,
}


def compute_cs_value(
    level: int,
    age: int | None,
    position: str | None,
    trajectory: str | None,
    tm_value_eur: int | None,
) -> int:
    """Compute CS Value in millions EUR (integer)."""
    # 1. Base from level
    base = level_to_base_value(level)

    # 2. Age modifier
    base *= age_modifier(age)

    # 3. Positional scarcity
    if position and position in POSITION_SCARCITY:
        base *= POSITION_SCARCITY[position]

    # 4. Trajectory
    if trajectory and trajectory in TRAJECTORY_MODIFIER:
        base *= TRAJECTORY_MODIFIER[trajectory]

    # 5. TM anchor blend: if we have TM data, blend 60% our model / 40% TM
    #    This keeps us grounded but allows divergence where we see it
    if tm_value_eur and tm_value_eur > 0:
        tm_m = tm_value_eur / 1_000_000
        # Weight our model more for players where we have strong opinions (high level)
        if level >= 85:
            blended = base * 0.65 + tm_m * 0.35
        else:
            blended = base * 0.55 + tm_m * 0.45
        base = blended

    # Floor at 0, round to integer millions
    return max(1, round(base))


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    # Fetch all players with level or overall data (overall as fallback)
    where_clauses = ["(pp.level IS NOT NULL OR pp.overall IS NOT NULL)"]
    params: list = []

    if args.player:
        where_clauses.append("p.id = %s")
        params.append(int(args.player))

    if not FORCE:
        where_clauses.append("(pm.director_valuation_meur IS NULL)")

    where = " AND ".join(where_clauses)
    limit_clause = f"LIMIT {args.limit}" if args.limit else ""

    sql = f"""
        SELECT
            p.id as person_id,
            p.name,
            p.date_of_birth,
            pp.level,
            pp.overall,
            pp.position::text as position,
            pm.market_value_eur,
            pm.transfer_fee_eur,
            cm.trajectory
        FROM people p
        JOIN player_profiles pp ON pp.person_id = p.id
        LEFT JOIN player_market pm ON pm.person_id = p.id
        LEFT JOIN career_metrics cm ON cm.person_id = p.id
        WHERE {where}
        ORDER BY COALESCE(pp.level, pp.overall) DESC NULLS LAST
        {limit_clause}
    """

    cur.execute(sql, params)
    rows = cur.fetchall()
    print(f"Found {len(rows)} players to value")

    if not rows:
        print("Nothing to do.")
        return

    # Compute values
    updates = []
    for row in rows:
        age = None
        if row["date_of_birth"]:
            today = date.today()
            dob = row["date_of_birth"]
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

        effective_level = row["level"] if row["level"] is not None else row.get("overall")
        if effective_level is None:
            continue

        cs_value = compute_cs_value(
            level=effective_level,
            age=age,
            position=row["position"],
            trajectory=row["trajectory"],
            tm_value_eur=row["market_value_eur"],
        )

        updates.append({
            "person_id": row["person_id"],
            "name": row["name"],
            "level": effective_level,
            "age": age,
            "position": row["position"],
            "trajectory": row["trajectory"],
            "tm_m": round(row["market_value_eur"] / 1_000_000) if row["market_value_eur"] else None,
            "cs_value": cs_value,
        })

    # Show top valuations
    top = sorted(updates, key=lambda x: x["cs_value"], reverse=True)[:20]
    print(f"\n{'Name':<25} {'Pos':<4} {'Lvl':>3} {'Age':>3} {'Traj':<12} {'TM €m':>6} {'CS €m':>6}")
    print("-" * 75)
    for u in top:
        tm_str = f"{u['tm_m']}m" if u["tm_m"] else "–"
        age_str = str(u["age"]) if u["age"] else "–"
        traj_str = u["trajectory"] or "–"
        print(f"{u['name']:<25} {u['position'] or '–':<4} {u['level']:>3} {age_str:>3} {traj_str:<12} {tm_str:>6} {u['cs_value']:>5}m")

    if DRY_RUN:
        print(f"\n[DRY RUN] Would update {len(updates)} players")
        return

    # Write to player_market via upsert
    # Some players may not have a player_market row yet — ensure it exists
    written = 0
    for u in updates:
        cur.execute("""
            INSERT INTO player_market (person_id, director_valuation_meur)
            VALUES (%s, %s)
            ON CONFLICT (person_id)
            DO UPDATE SET director_valuation_meur = EXCLUDED.director_valuation_meur,
                          updated_at = now()
        """, (u["person_id"], u["cs_value"]))
        written += 1

    print(f"\nUpdated {written} players with CS Value")

    # Summary stats
    values = [u["cs_value"] for u in updates]
    print(f"  Range: €{min(values)}m – €{max(values)}m")
    print(f"  Median: €{sorted(values)[len(values)//2]}m")
    print(f"  Mean: €{sum(values)//len(values)}m")

    cur.close()


if __name__ == "__main__":
    main()
