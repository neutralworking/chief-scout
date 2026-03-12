"""
26_key_moments.py — Generate key_moments from career history and news stories.

Sources:
  1. Career milestones: debuts, transfers, loan spells from player_career_history
  2. News-derived moments: high-confidence tagged stories with strong sentiment

Writes to `key_moments` table.

Usage:
    python 26_key_moments.py                    # all players with data
    python 26_key_moments.py --player 123       # single player
    python 26_key_moments.py --limit 100        # first 100 players
    python 26_key_moments.py --dry-run           # preview without writing
    python 26_key_moments.py --force             # overwrite existing moments
    python 26_key_moments.py --source career     # career milestones only
    python 26_key_moments.py --source news       # news moments only

Requires: key_moments table (migration 007)
"""
import argparse
import sys
from datetime import datetime, timezone

from supabase import create_client

from config import POSTGRES_DSN, SUPABASE_URL, SUPABASE_SERVICE_KEY

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Generate key moments from career + news data")
parser.add_argument("--player", type=str, default=None,
                    help="Single person_id to process")
parser.add_argument("--limit", type=int, default=None,
                    help="Max players to process")
parser.add_argument("--dry-run", action="store_true",
                    help="Print summaries without writing to database")
parser.add_argument("--force", action="store_true",
                    help="Overwrite existing moments")
parser.add_argument("--source", choices=["career", "news", "all"],
                    default="all", help="Which source to process (default: all)")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
SOURCE = args.source
CHUNK_SIZE = 100

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

def format_date_short(d):
    """Format a date for display."""
    if d is None:
        return ""
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return f"{months[d.month - 1]} {d.year}"


def chunked_upsert(rows, on_conflict="person_id,title"):
    """Upsert to key_moments, deduplicating on person_id + title."""
    if not rows:
        return 0
    if DRY_RUN:
        print(f"  [dry-run] would upsert {len(rows)} key_moments")
        return len(rows)
    total = 0
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i:i + CHUNK_SIZE]
        sb_client.table("key_moments").upsert(
            chunk, on_conflict=on_conflict
        ).execute()
        total += len(chunk)
    return total


# ── Career Milestones ─────────────────────────────────────────────────────────

def generate_career_moments(cur):
    """Generate moments from player_career_history: debuts, transfers, loans."""
    print("\n── Career Milestones ──────────────────────────────────────────────")

    where_clauses = []
    params = []

    if args.player:
        where_clauses.append("ch.person_id = %s")
        params.append(int(args.player))

    if not FORCE:
        where_clauses.append("""
            ch.person_id NOT IN (
                SELECT DISTINCT person_id FROM key_moments
                WHERE moment_type IN ('milestone', 'transfer')
            )
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
            p.name AS player_name
        FROM player_career_history ch
        JOIN people p ON p.id = ch.person_id
        {where_sql}
        ORDER BY ch.person_id, ch.sort_order, ch.start_date
    """
    cur.execute(query, params)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]

    if not rows:
        print("  No career history data found.")
        return 0

    # Group by player
    players = {}
    for row in rows:
        d = dict(zip(cols, row))
        pid = d["person_id"]
        players.setdefault(pid, []).append(d)

    player_ids = list(players.keys())
    if args.limit:
        player_ids = player_ids[:args.limit]

    print(f"  Players with career data: {len(player_ids)}")

    now_iso = datetime.now(timezone.utc).isoformat()
    moments = []
    stats = {"debuts": 0, "transfers": 0, "loans": 0, "long_service": 0}

    for pid in player_ids:
        entries = players[pid]
        order = 0

        for i, e in enumerate(entries):
            club = e["club_name"]
            start = e["start_date"]
            end = e["end_date"]
            is_loan = e["is_loan"]

            # First ever club = career debut
            if i == 0 and start:
                moments.append({
                    "person_id": str(pid),
                    "title": f"Professional debut — {club}",
                    "description": f"Began professional career at {club}.",
                    "moment_date": start.isoformat() if start else None,
                    "moment_type": "milestone",
                    "sentiment": "positive",
                    "display_order": order,
                    "created_at": now_iso,
                    "updated_at": now_iso,
                })
                order += 1
                stats["debuts"] += 1

            # Loan spells
            elif is_loan and start:
                moments.append({
                    "person_id": str(pid),
                    "title": f"Loan move to {club}",
                    "description": f"Joined {club} on loan ({format_date_short(start)}).",
                    "moment_date": start.isoformat(),
                    "moment_type": "transfer",
                    "sentiment": "neutral",
                    "display_order": order,
                    "created_at": now_iso,
                    "updated_at": now_iso,
                })
                order += 1
                stats["loans"] += 1

            # Permanent transfer (not first club, not loan)
            elif i > 0 and not is_loan and start:
                moments.append({
                    "person_id": str(pid),
                    "title": f"Signed for {club}",
                    "description": f"Permanent transfer to {club} ({format_date_short(start)}).",
                    "moment_date": start.isoformat(),
                    "moment_type": "transfer",
                    "sentiment": "neutral",
                    "display_order": order,
                    "created_at": now_iso,
                    "updated_at": now_iso,
                })
                order += 1
                stats["transfers"] += 1

            # Long service award (5+ years at a club)
            if start and end:
                delta_years = (end - start).days / 365.25
                if delta_years >= 5 and not is_loan:
                    moments.append({
                        "person_id": str(pid),
                        "title": f"{int(delta_years)} years at {club}",
                        "description": f"Completed {int(delta_years)} years of service at {club}.",
                        "moment_date": end.isoformat(),
                        "moment_type": "milestone",
                        "sentiment": "positive",
                        "display_order": order,
                        "created_at": now_iso,
                        "updated_at": now_iso,
                    })
                    order += 1
                    stats["long_service"] += 1
            elif start and end is None:
                # Current club — check if 5+ years
                from datetime import date as date_type
                delta_years = (date_type.today() - start).days / 365.25
                if delta_years >= 5 and not is_loan:
                    moments.append({
                        "person_id": str(pid),
                        "title": f"{int(delta_years)}+ years at {club}",
                        "description": f"Over {int(delta_years)} years of service at {club} and counting.",
                        "moment_date": None,
                        "moment_type": "milestone",
                        "sentiment": "positive",
                        "display_order": order,
                        "created_at": now_iso,
                        "updated_at": now_iso,
                    })
                    order += 1
                    stats["long_service"] += 1

    print(f"  Moments generated: {len(moments)}")
    print(f"    Debuts:       {stats['debuts']}")
    print(f"    Transfers:    {stats['transfers']}")
    print(f"    Loans:        {stats['loans']}")
    print(f"    Long service: {stats['long_service']}")

    return moments


# ── News-Derived Moments ──────────────────────────────────────────────────────

def generate_news_moments(cur):
    """Generate moments from high-signal news stories."""
    print("\n── News-Derived Moments ───────────────────────────────────────────")

    where_clauses = ["npt.confidence >= 0.7"]
    params = []

    if args.player:
        where_clauses.append("npt.player_id = %s")
        params.append(int(args.player))

    if not FORCE:
        where_clauses.append("""
            npt.player_id NOT IN (
                SELECT DISTINCT person_id FROM key_moments
                WHERE news_story_id IS NOT NULL
            )
        """)

    where_sql = "WHERE " + " AND ".join(where_clauses)

    query = f"""
        SELECT
            npt.player_id AS person_id,
            npt.story_id,
            npt.story_type,
            npt.confidence,
            npt.sentiment,
            ns.headline,
            ns.summary,
            ns.url,
            ns.published_at,
            ns.id AS news_story_id
        FROM news_player_tags npt
        JOIN news_stories ns ON ns.id = npt.story_id
        {where_sql}
        ORDER BY npt.player_id, ns.published_at DESC
    """
    cur.execute(query, params)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]

    if not rows:
        print("  No qualifying news stories found.")
        return []

    # Group by player, keep top stories
    players = {}
    for row in rows:
        d = dict(zip(cols, row))
        pid = d["person_id"]
        players.setdefault(pid, []).append(d)

    player_ids = list(players.keys())
    if args.limit:
        player_ids = player_ids[:args.limit]

    print(f"  Players with tagged news: {len(player_ids)}")

    # Map story_type → moment_type
    TYPE_MAP = {
        "transfer": "transfer",
        "injury": "performance",
        "form": "performance",
        "contract": "milestone",
        "debut": "milestone",
        "personal": "controversy",
        "discipline": "controversy",
        "tactical": "performance",
        "award": "milestone",
    }

    now_iso = datetime.now(timezone.utc).isoformat()
    moments = []
    type_counts = {}

    for pid in player_ids:
        stories = players[pid]
        # Keep top 5 most relevant per player (highest confidence, strongest sentiment)
        scored = []
        for s in stories:
            # Score: confidence * sentiment strength
            sentiment_weight = 1.2 if s["sentiment"] in ("positive", "negative") else 0.8
            score = (s["confidence"] or 0.5) * sentiment_weight
            scored.append((score, s))

        scored.sort(key=lambda x: -x[0])
        top = scored[:5]

        for order, (_, s) in enumerate(top):
            story_type = s["story_type"] or "performance"
            moment_type = TYPE_MAP.get(story_type, "performance")
            type_counts[moment_type] = type_counts.get(moment_type, 0) + 1

            moments.append({
                "person_id": str(pid),
                "news_story_id": str(s["news_story_id"]),
                "title": s["headline"][:200],
                "description": (s["summary"] or "")[:500] or None,
                "moment_date": str(s["published_at"])[:10] if s["published_at"] else None,
                "moment_type": moment_type,
                "sentiment": s["sentiment"] or "neutral",
                "source_url": s["url"],
                "display_order": order,
                "created_at": now_iso,
                "updated_at": now_iso,
            })

    print(f"  Moments generated: {len(moments)}")
    for mt, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"    {mt:15s}  {c}")

    return moments


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Key Moments Builder")
    print(f"  Source:  {SOURCE}")
    print(f"  Dry run: {DRY_RUN}")
    print(f"  Force:   {FORCE}")

    cur = conn.cursor()
    all_moments = []

    if SOURCE in ("career", "all"):
        career_moments = generate_career_moments(cur)
        all_moments.extend(career_moments)

    if SOURCE in ("news", "all"):
        news_moments = generate_news_moments(cur)
        all_moments.extend(news_moments)

    # Deduplicate by (person_id, title)
    seen = set()
    deduped = []
    for m in all_moments:
        key = (m["person_id"], m["title"][:100])
        if key not in seen:
            seen.add(key)
            deduped.append(m)

    print(f"\n  Total unique moments: {len(deduped)}")

    # We can't use on_conflict with person_id+title since there's no unique constraint.
    # Insert directly, skipping duplicates.
    if deduped and not DRY_RUN:
        # Check existing titles per player to avoid duplicates
        player_ids = list(set(int(m["person_id"]) for m in deduped))
        existing = set()
        for i in range(0, len(player_ids), 100):
            chunk_ids = player_ids[i:i+100]
            cur.execute(
                "SELECT person_id, title FROM key_moments WHERE person_id = ANY(%s::bigint[])",
                (chunk_ids,)
            )
            for row in cur.fetchall():
                existing.add((str(row[0]), row[1][:100]))

        to_insert = [m for m in deduped if (m["person_id"], m["title"][:100]) not in existing]
        print(f"  New moments to insert: {len(to_insert)} (skipping {len(deduped) - len(to_insert)} existing)")

        if to_insert:
            inserted = 0
            for i in range(0, len(to_insert), CHUNK_SIZE):
                chunk = to_insert[i:i + CHUNK_SIZE]
                sb_client.table("key_moments").insert(chunk).execute()
                inserted += len(chunk)
            print(f"  Inserted: {inserted}")
        else:
            print("  Nothing new to insert.")
    elif DRY_RUN:
        print(f"  [dry-run] would insert up to {len(deduped)} moments")

    # Show sample
    if deduped:
        sample = deduped[0]
        print(f"\n  Sample moment:")
        print(f"    player:  {sample['person_id']}")
        print(f"    title:   {sample['title'][:80]}")
        print(f"    type:    {sample['moment_type']}")
        print(f"    date:    {sample.get('moment_date', '?')}")

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
