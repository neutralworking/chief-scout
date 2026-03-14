"""
23_career_metrics.py — Compute career trajectory metrics from player_career_history,
writing results to `career_metrics` table.

Derives loyalty, mobility, trajectory labels, and tenure stats from the
career history populated by 19_wikidata_deep_enrich.py.

Usage:
    python 23_career_metrics.py                  # all players with career data
    python 23_career_metrics.py --player UUID     # single player
    python 23_career_metrics.py --limit 50        # first 50 players
    python 23_career_metrics.py --dry-run         # preview without writing
    python 23_career_metrics.py --force           # overwrite existing rows

Requires migration: 016_career_news_tables.sql
"""
import argparse
import math
import sys
from datetime import datetime, timezone, date

from supabase import create_client

from config import POSTGRES_DSN, SUPABASE_URL, SUPABASE_SERVICE_KEY

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Compute career trajectory metrics")
parser.add_argument("--player", type=str, default=None,
                    help="Single person_id (UUID) to process")
parser.add_argument("--limit", type=int, default=None,
                    help="Max players to process")
parser.add_argument("--dry-run", action="store_true",
                    help="Print summaries without writing to database")
parser.add_argument("--force", action="store_true",
                    help="Overwrite existing rows")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
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

# ── Helpers ────────────────────────────────────────────────────────────────────

TODAY = date.today()


def years_between(d1, d2):
    """Return fractional years between two dates."""
    if d1 is None or d2 is None:
        return None
    delta = d2 - d1
    return round(delta.days / 365.25, 1)


def classify_trajectory(clubs_count, career_years, avg_tenure, current_club_yrs, loan_count):
    """Assign a trajectory label based on career shape."""
    if clubs_count <= 1 and (career_years or 0) >= 3:
        return "one-club"
    if (career_years or 0) < 2:
        return "newcomer"
    if clubs_count >= 6 and (avg_tenure or 0) < 2:
        return "journeyman"

    # Rising: young career, few clubs, currently at a club
    if (career_years or 0) <= 6 and clubs_count <= 3 and current_club_yrs is not None:
        return "rising"

    # Peak: mid-career, stable
    if 4 <= (career_years or 0) <= 12 and (avg_tenure or 0) >= 2:
        return "peak"

    # Declining: long career, many moves
    if (career_years or 0) > 12:
        return "declining"

    return "peak"


def compute_loyalty_score(avg_tenure, max_tenure, clubs_count, career_years):
    """1-10 loyalty score. High = long tenures, few moves."""
    if career_years is None or career_years <= 0:
        return 5

    moves_per_year = max((clubs_count - 1), 0) / max(career_years, 1)
    # Lower moves_per_year = more loyal
    loyalty_raw = (
        (min(avg_tenure or 0, 10) / 10) * 40 +       # avg tenure (0-10 yrs → 0-40)
        (min(max_tenure or 0, 15) / 15) * 30 +        # max tenure (0-15 yrs → 0-30)
        max(0, (1 - moves_per_year)) * 30              # low move rate → 0-30
    )
    return max(1, min(10, round(loyalty_raw / 10)))


def compute_mobility_score(clubs_count, career_years, loan_count, leagues_count):
    """1-10 mobility score. High = many moves, diverse experience."""
    if career_years is None or career_years <= 0:
        return 5

    moves_per_year = max((clubs_count - 1), 0) / max(career_years, 1)
    mobility_raw = (
        min(clubs_count, 10) / 10 * 30 +               # club count (0-10 → 0-30)
        min(moves_per_year, 1) * 30 +                   # move rate → 0-30
        min(loan_count, 5) / 5 * 20 +                   # loans → 0-20
        min(leagues_count or 0, 5) / 5 * 20             # league diversity → 0-20
    )
    return max(1, min(10, round(mobility_raw / 10)))


def chunked_upsert(rows):
    if not rows:
        return 0
    if DRY_RUN:
        print(f"  [dry-run] would upsert {len(rows)} rows into career_metrics")
        return len(rows)
    total = 0
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i:i + CHUNK_SIZE]
        sb_client.table("career_metrics").upsert(
            chunk, on_conflict="person_id"
        ).execute()
        total += len(chunk)
    return total


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Career Metrics Builder")
    print(f"  Dry run: {DRY_RUN}")
    print(f"  Force:   {FORCE}")

    cur = conn.cursor()

    # Fetch all career history entries grouped by player
    where_clauses = []
    params = []

    if args.player:
        where_clauses.append("ch.person_id = %s")
        params.append(args.player)

    if not FORCE:
        where_clauses.append("""
            ch.person_id NOT IN (SELECT person_id FROM career_metrics)
        """)

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    query = f"""
        SELECT
            ch.person_id,
            ch.club_name,
            ch.club_id,
            ch.start_date,
            ch.end_date,
            ch.is_loan,
            ch.sort_order,
            ch.team_type,
            c.league_name AS league
        FROM player_career_history ch
        LEFT JOIN clubs c ON c.id = ch.club_id
        {where_sql}
        ORDER BY ch.person_id, ch.sort_order, ch.start_date
    """
    cur.execute(query, params)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]

    if not rows:
        print("  No career history data found.")
        cur.close()
        conn.close()
        return

    # Group by player
    players = {}
    for row in rows:
        d = dict(zip(cols, row))
        pid = d["person_id"]
        players.setdefault(pid, []).append(d)

    # Apply limit
    player_ids = list(players.keys())
    if args.limit:
        player_ids = player_ids[:args.limit]

    print(f"  Players with career history: {len(player_ids)}")

    # Compute metrics per player
    upsert_rows = []
    now_iso = datetime.now(timezone.utc).isoformat()

    stats = {"processed": 0, "skipped_empty": 0}
    trajectory_counts = {}

    for pid in player_ids:
        entries = players[pid]

        if not entries:
            stats["skipped_empty"] += 1
            continue

        # Split entries by team type — only senior clubs count for metrics
        senior_entries = [e for e in entries if e.get("team_type") in ("senior_club", None)]
        national_entries = [e for e in entries if e.get("team_type") == "national_team"]

        # Distinct senior clubs (by club_name or club_id)
        all_clubs = set()
        loan_count = 0
        leagues = set()

        tenures = []
        current_club_yrs = None

        for e in senior_entries:
            club_key = e["club_id"] or e["club_name"]
            if club_key:
                all_clubs.add(club_key)
            if e["is_loan"]:
                loan_count += 1
            if e.get("league"):
                leagues.add(e["league"])

            start = e["start_date"]
            end = e["end_date"]

            if start:
                tenure_end = end or TODAY
                yrs = years_between(start, tenure_end)
                if yrs is not None and yrs >= 0:
                    tenures.append(yrs)
                # Current club = no end_date
                if end is None:
                    current_club_yrs = yrs

        clubs_count = len(all_clubs)
        leagues_count = len(leagues)
        international_teams = len(set(
            (e["club_id"] or e["club_name"]) for e in national_entries
            if e["club_id"] or e["club_name"]
        ))

        # Career span (senior clubs only)
        starts = [e["start_date"] for e in senior_entries if e["start_date"]]
        ends = [e["end_date"] for e in senior_entries if e["end_date"]]
        if starts:
            career_start = min(starts)
            career_end = max(ends) if ends else TODAY
            career_years = years_between(career_start, career_end)
        else:
            career_years = None

        avg_tenure = round(sum(tenures) / len(tenures), 1) if tenures else None
        max_tenure = round(max(tenures), 1) if tenures else None

        trajectory = classify_trajectory(
            clubs_count, career_years, avg_tenure, current_club_yrs, loan_count
        )
        loyalty = compute_loyalty_score(avg_tenure, max_tenure, clubs_count, career_years)
        mobility = compute_mobility_score(clubs_count, career_years, loan_count, leagues_count)

        trajectory_counts[trajectory] = trajectory_counts.get(trajectory, 0) + 1

        upsert_rows.append({
            "person_id": str(pid),
            "clubs_count": clubs_count,
            "loan_count": loan_count,
            "career_years": float(career_years) if career_years else None,
            "avg_tenure_yrs": float(avg_tenure) if avg_tenure else None,
            "max_tenure_yrs": float(max_tenure) if max_tenure else None,
            "current_club_yrs": float(current_club_yrs) if current_club_yrs else None,
            "loyalty_score": loyalty,
            "mobility_score": mobility,
            "trajectory": trajectory,
            "leagues_count": leagues_count,
            "updated_at": now_iso,
        })
        stats["processed"] += 1

    # Show sample
    if upsert_rows:
        sample = upsert_rows[0]
        print(f"\n  Sample (person_id={sample['person_id']}):")
        for key in ["clubs_count", "loan_count", "career_years", "avg_tenure_yrs",
                     "max_tenure_yrs", "current_club_yrs", "loyalty_score",
                     "mobility_score", "trajectory", "leagues_count"]:
            print(f"    {key:20s}  {sample[key]}")

    # Trajectory distribution
    print(f"\n  Trajectory distribution:")
    for t, c in sorted(trajectory_counts.items(), key=lambda x: -x[1]):
        print(f"    {t:15s}  {c}")

    # Upsert
    n = chunked_upsert(upsert_rows)

    print(f"\n── Summary ───────────────────────────────────────────────────────")
    print(f"  Processed:   {stats['processed']}")
    print(f"  Skipped:     {stats['skipped_empty']}")
    print(f"  Upserted:    {n}")
    if DRY_RUN:
        print("  (dry-run — no data was written)")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
