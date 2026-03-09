"""
add_valuation_columns.py — Add the three missing valuation dimensions:

  true_mvt            (1–5)  Pure quality tier — level/peak only, no context bonus.
                             This is what a player is actually worth as a footballer.

  market_premium      (-2–3) market_value_tier minus true_mvt.
                             Positive = inflated (Frankfurt effect, scarcity, PR tax).
                             Negative = undervalued (reputation damage, bad loan).
                             Zero = fairly priced.

  scarcity_score      (1–5)  How few active players share the same position+mvt.
                             5 = nearly irreplaceable (1–3 peers globally).
                             1 = abundant (80+ direct peers).

  national_scarcity   (1–5)  Same but filtered to same nation.
                             Captures the "had to be French" PR premium.
"""
from __future__ import annotations
import sys
from collections import defaultdict

from config import POSTGRES_DSN

DRY_RUN = "--dry-run" in sys.argv

TOP_5_LEAGUES = frozenset({
    "Premier League", "LaLiga", "La Liga",
    "Bundesliga", "Serie A", "Ligue 1",
})
TOP_LEAGUES = TOP_5_LEAGUES | frozenset({
    "Primeira Liga", "Eredivisie", "Süper Lig",
    "Premiership", "Belgian Pro League",
})


def compute_true_mvt(level, peak) -> int:
    """Pure quality — no division floor."""
    q = level if level else (peak * 0.92 if peak else 0)
    if q >= 90:   return 5
    elif q >= 86: return 4
    elif q >= 82: return 3
    elif q >= 78: return 2
    elif q > 0:   return 1
    else:         return 1


def peers_to_scarcity(n: int) -> int:
    """Convert peer count to 1–5 scarcity score."""
    if n <= 3:   return 5   # nearly irreplaceable
    if n <= 10:  return 4   # very rare
    if n <= 30:  return 3   # uncommon
    if n <= 80:  return 2   # moderate supply
    return 1                # abundant


def main():
    import psycopg2
    import psycopg2.extras

    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Columns now live in player_market — no ALTER needed
    print("Columns ready.")

    # Load all players
    cur.execute("""
        SELECT id, level, peak, division, position, nation,
               market_value_tier
        FROM players
    """)
    players = cur.fetchall()
    print(f"Loaded {len(players):,} players.")

    # ── Build scarcity lookup tables ────────────────────────────────────────
    # Active = has club or division (we didn't load club here — use division as proxy)
    # More precise: re-query with club
    cur.execute("""
        SELECT position, nation, market_value_tier, COUNT(*) n
        FROM players
        WHERE position IS NOT NULL
          AND market_value_tier IS NOT NULL
          AND (club IS NOT NULL OR division IS NOT NULL)
        GROUP BY position, nation, market_value_tier
    """)
    # pos+mvt peer count (all nations)
    pos_mvt_count: dict[tuple, int] = defaultdict(int)
    # pos+nation+mvt peer count
    pos_nat_mvt_count: dict[tuple, int] = defaultdict(int)

    for r in cur.fetchall():
        pos = r["position"]
        nat = r["nation"] or ""
        mvt = r["market_value_tier"]
        n   = r["n"]
        pos_mvt_count[(pos, mvt)]       += n
        pos_nat_mvt_count[(pos, nat, mvt)] += n

    # ── Compute per-player values ────────────────────────────────────────────
    updates = []
    premium_dist: dict[int, int] = defaultdict(int)
    scarcity_dist: dict[int, int] = defaultdict(int)

    for p in players:
        pid  = p["id"]
        true_mvt = compute_true_mvt(p["level"], p["peak"])
        perceived_mvt = p["market_value_tier"] or true_mvt

        premium = perceived_mvt - true_mvt   # signed; can be negative

        pos = p["position"]
        nat = p["nation"] or ""
        mvt = perceived_mvt

        if pos:
            peer_n     = pos_mvt_count.get((pos, mvt), 0)
            nat_peer_n = pos_nat_mvt_count.get((pos, nat, mvt), 0)
            scarcity   = peers_to_scarcity(peer_n)
            nat_scarcity = peers_to_scarcity(nat_peer_n) if nat else None
        else:
            scarcity = None
            nat_scarcity = None

        premium_dist[premium]  += 1
        if scarcity: scarcity_dist[scarcity] += 1

        updates.append((true_mvt, premium, scarcity, nat_scarcity, pid))

    # ── Preview ──────────────────────────────────────────────────────────────
    print(f"\nMarket premium distribution (perceived - true):")
    for k in sorted(premium_dist):
        label = f"+{k}" if k > 0 else str(k)
        print(f"  {label:>3}  {premium_dist[k]:>6,} players")

    print(f"\nScarcity score distribution (active, positional peers):")
    for k in sorted(scarcity_dist, reverse=True):
        desc = {5:"nearly irreplaceable",4:"very rare",3:"uncommon",2:"moderate",1:"abundant"}
        print(f"  {k}  {scarcity_dist[k]:>6,}  {desc[k]}")

    # Show most scarce players
    print(f"\nSample: most scarce active players (pos+MVT scarcity 5):")
    cur.execute("""
        SELECT p.name, p.position, p.market_value_tier, p.nation, p.club, p.division
        FROM players p
        WHERE (p.club IS NOT NULL OR p.division IS NOT NULL)
          AND p.position IS NOT NULL
        ORDER BY p.market_value_tier DESC NULLS LAST, p.level DESC NULLS LAST
        LIMIT 15
    """)
    for r in cur.fetchall():
        pos = r["position"]; mvt = r["market_value_tier"]; nat = r["nation"] or "?"
        peers = pos_mvt_count.get((pos, mvt), 0)
        nat_peers = pos_nat_mvt_count.get((pos, nat, mvt), 0)
        sc  = peers_to_scarcity(peers)
        nsc = peers_to_scarcity(nat_peers)
        if sc >= 4 or nsc >= 4:
            print(f"  {r['name']:<28} {pos} MVT{mvt}  peers:{peers:>3} sc:{sc}  "
                  f"nat_peers:{nat_peers} nsc:{nsc}  [{nat}]")

    if DRY_RUN:
        print("\n--dry-run: no writes.")
        conn.rollback()
        conn.close()
        return

    print("\nWriting...")
    BATCH = 500
    for i in range(0, len(updates), BATCH):
        batch = updates[i:i+BATCH]
        cur.executemany(
            """UPDATE player_market SET
                true_mvt = %s,
                market_premium = %s,
                scarcity_score = %s,
                national_scarcity = %s
               WHERE person_id = %s""",
            batch,
        )
        conn.commit()
        print(f"  {min(i+BATCH, len(updates)):,}/{len(updates):,}", end="\r")

    print(f"\nDone. {len(updates):,} rows updated.")

    # Final summary
    cur.execute("""
        SELECT
            AVG(market_premium)::NUMERIC(4,2) avg_premium,
            MAX(market_premium) max_premium,
            MIN(market_premium) min_premium,
            COUNT(*) FILTER (WHERE market_premium > 0) inflated,
            COUNT(*) FILTER (WHERE market_premium < 0) undervalued,
            COUNT(*) FILTER (WHERE market_premium = 0) fair
        FROM players WHERE market_premium IS NOT NULL
    """)
    s = cur.fetchone()
    print(f"\nMarket premium summary:")
    print(f"  avg={s['avg_premium']}  max={s['max_premium']}  min={s['min_premium']}")
    print(f"  inflated: {s['inflated']:,}  fair: {s['fair']:,}  undervalued: {s['undervalued']:,}")

    conn.close()


if __name__ == "__main__":
    main()
