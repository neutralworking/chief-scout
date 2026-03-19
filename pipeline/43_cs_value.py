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
# "What would the fee be if they moved tomorrow?"
# Calibrated 2026-03-19 against 10 DoF-anchored values.
# L92=146, L91=126, L90=106, L89=91, L88=76, L85=40, L80=15, L75=5
def level_to_base_value(level: int) -> float:
    """Convert scouting level (1-99) to base value in millions EUR."""
    if level < 65:
        return 0.1
    if level < 70:
        return 0.5 + (level - 65) * 0.3
    if level < 75:
        return 2.0 + (level - 70) * 0.6
    if level < 80:
        return 5.0 + (level - 75) * 2.0    # 5 - 15m
    if level < 85:
        return 15.0 + (level - 80) * 5.0   # 15 - 40m
    if level < 88:
        return 40.0 + (level - 85) * 12.0  # 40, 52, 64
    if level < 90:
        return 76.0 + (level - 88) * 15.0  # 76, 91
    if level < 92:
        return 106.0 + (level - 90) * 20.0  # 106, 126
    return 146.0 + (level - 92) * 25.0      # 146, 171, 196


def age_modifier(age: int | None, level: int = 80) -> float:
    """Return multiplier based on age AND level.

    Youth premium scales with level: an 18yo at L92 (Yamal) is generational
    and commands a massive premium. An 18yo at L70 is just a prospect.

    Elite players (88+) retain value longer — still world-class output.
    """
    if age is None:
        return 1.0

    is_elite = level >= 88

    # ── Youth (under 24): premium scales with level ──
    if age <= 17:
        return 0.45 + (max(0, level - 80) * 0.05)
    if age == 18:
        return 0.65 + (max(0, level - 80) * 0.08)  # L92: 1.61
    if age == 19:
        return 0.80 + (max(0, level - 80) * 0.05)
    if age == 20:
        return 0.92 + (max(0, level - 82) * 0.03)
    if age == 21:
        return 1.02 + (max(0, level - 84) * 0.02)
    if age == 22:
        return 1.03 + (max(0, level - 86) * 0.015)
    if age == 23:
        return 1.02

    # ── Peak window (24-29) ──
    if age <= 26:
        return 1.0
    if age == 27:
        return 0.96
    if age == 28:
        return 0.90
    if age == 29:
        return 0.80

    # ── Decline (30+): gentler for elite players ──
    if is_elite:
        decay = {30: 0.68, 31: 0.58, 32: 0.50, 33: 0.40, 34: 0.30, 35: 0.22}
        return decay.get(age, 0.15)
    decay = {30: 0.50, 31: 0.38, 32: 0.28, 33: 0.20, 34: 0.14, 35: 0.08}
    return decay.get(age, 0.05)


# Positional scarcity
POSITION_SCARCITY = {
    "DM": 1.08,
    "WM": 1.05,
    "AM": 1.03,
    "WD": 1.02,
    "CF": 1.00,
    "WF": 1.00,
    "CD": 1.00,
    "CM": 0.97,
    "GK": 0.78,
}

# Trajectory modifier
TRAJECTORY_MODIFIER = {
    "rising": 1.10,
    "peak": 1.0,
    "declining": 0.82,
    "newcomer": 1.05,
    "journeyman": 0.92,
    "one-club": 1.02,
}


def buyer_pool_modifier(level: int, age: int | None, position: str | None) -> float:
    """Buyer pool discount — fewer clubs = lower fee."""
    if age is None:
        age = 27
    pool = 1.0
    if level >= 92:
        pool = 0.90
    elif level >= 90:
        pool = 0.94
    if age >= 31:
        pool *= 0.90
    if position == "GK" and level >= 85:
        pool *= 0.93
    return pool


def compute_cs_value(
    level: int,
    age: int | None,
    position: str | None,
    trajectory: str | None,
    tm_value_eur: int | None,
) -> int:
    """Compute CS Value in millions EUR.

    "What would the fee be if they moved tomorrow?"
    """
    base = level_to_base_value(level)
    base *= age_modifier(age, level)

    if position and position in POSITION_SCARCITY:
        base *= POSITION_SCARCITY[position]
    if trajectory and trajectory in TRAJECTORY_MODIFIER:
        base *= TRAJECTORY_MODIFIER[trajectory]

    base *= buyer_pool_modifier(level, age, position)

    # TM anchor blend (20% TM, 80% our model)
    if tm_value_eur and tm_value_eur > 0:
        tm_m = tm_value_eur / 1_000_000
        base = base * 0.80 + tm_m * 0.20

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
