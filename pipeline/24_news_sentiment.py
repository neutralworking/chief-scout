"""
24_news_sentiment.py — Aggregate news sentiment trends from news_player_tags,
writing results to `news_sentiment_agg` table.

Computes per-player mention counts, sentiment breakdown, buzz scores,
dominant story types, and recent trend windows from the news data
populated by 12_news_ingest.py.

Usage:
    python 24_news_sentiment.py                  # all players with news tags
    python 24_news_sentiment.py --player UUID     # single player
    python 24_news_sentiment.py --days 90         # only stories from last 90 days
    python 24_news_sentiment.py --limit 50        # first 50 players
    python 24_news_sentiment.py --dry-run         # preview without writing
    python 24_news_sentiment.py --force           # overwrite existing rows

Requires migration: 016_career_news_tables.sql
"""
import argparse
import json
import sys
from datetime import datetime, timezone, timedelta

from supabase import create_client

from config import POSTGRES_DSN, SUPABASE_URL, SUPABASE_SERVICE_KEY

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Aggregate news sentiment per player")
parser.add_argument("--player", type=str, default=None,
                    help="Single person_id (UUID) to process")
parser.add_argument("--days", type=int, default=None,
                    help="Only include stories from the last N days")
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

NOW = datetime.now(timezone.utc)


def sentiment_to_numeric(sentiment):
    """Map sentiment label to a numeric value for averaging."""
    mapping = {
        "positive": 1.0,
        "neutral": 0.0,
        "negative": -1.0,
    }
    return mapping.get(str(sentiment).lower(), 0.0)


def compute_sentiment_score(positive, negative, neutral, total):
    """1-20 sentiment score. 10 = neutral, 20 = overwhelmingly positive."""
    if total == 0:
        return 10
    net = (positive - negative) / total  # range: -1 to +1
    # Map [-1, +1] → [1, 20]
    return max(1, min(20, round(10 + net * 10)))


def compute_buzz_score(total_mentions, trend_7d, trend_30d):
    """1-20 buzz score based on mention volume and recency."""
    if total_mentions == 0:
        return 1

    # Weighted: recent mentions matter more
    recency_weight = (trend_7d or 0) * 4 + (trend_30d or 0)
    volume_component = min(total_mentions, 50) / 50 * 10   # 0-10 from total volume
    recency_component = min(recency_weight, 30) / 30 * 10  # 0-10 from recency

    raw = volume_component + recency_component
    return max(1, min(20, round(raw)))


def chunked_upsert(rows):
    if not rows:
        return 0
    if DRY_RUN:
        print(f"  [dry-run] would upsert {len(rows)} rows into news_sentiment_agg")
        return len(rows)
    total = 0
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i:i + CHUNK_SIZE]
        sb_client.table("news_sentiment_agg").upsert(
            chunk, on_conflict="person_id"
        ).execute()
        total += len(chunk)
    return total


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("News Sentiment Aggregator")
    print(f"  Days:    {args.days or 'all'}")
    print(f"  Dry run: {DRY_RUN}")
    print(f"  Force:   {FORCE}")

    cur = conn.cursor()

    # Build query for tagged news
    where_clauses = ["npt.player_id IS NOT NULL"]
    params = []

    if args.player:
        where_clauses.append("npt.player_id = %s")
        params.append(args.player)

    if args.days:
        cutoff = NOW - timedelta(days=args.days)
        where_clauses.append("ns.published_at >= %s")
        params.append(cutoff)

    if not FORCE:
        where_clauses.append("""
            npt.player_id NOT IN (SELECT person_id FROM news_sentiment_agg)
        """)

    where_sql = "WHERE " + " AND ".join(where_clauses)

    query = f"""
        SELECT
            npt.player_id,
            npt.story_type,
            npt.confidence,
            npt.sentiment,
            ns.published_at
        FROM news_player_tags npt
        JOIN news_stories ns ON ns.id = npt.story_id
        {where_sql}
        ORDER BY npt.player_id, ns.published_at DESC
    """
    cur.execute(query, params)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]

    if not rows:
        print("  No news tag data found.")
        cur.close()
        conn.close()
        return

    # Group by player
    players = {}
    for row in rows:
        d = dict(zip(cols, row))
        pid = d["player_id"]
        players.setdefault(pid, []).append(d)

    # Apply limit
    player_ids = list(players.keys())
    if args.limit:
        player_ids = player_ids[:args.limit]

    print(f"  Players with news mentions: {len(player_ids)}")

    # Compute aggregates per player
    upsert_rows = []
    now_iso = NOW.isoformat()

    cutoff_7d = NOW - timedelta(days=7)
    cutoff_30d = NOW - timedelta(days=30)

    stats = {"processed": 0, "high_buzz": 0}
    sentiment_dist = {"positive": 0, "negative": 0, "neutral": 0}

    for pid in player_ids:
        entries = players[pid]
        total = len(entries)

        # Sentiment counts
        positive = sum(1 for e in entries if str(e.get("sentiment", "")).lower() == "positive")
        negative = sum(1 for e in entries if str(e.get("sentiment", "")).lower() == "negative")
        neutral = total - positive - negative

        sentiment_dist["positive"] += positive
        sentiment_dist["negative"] += negative
        sentiment_dist["neutral"] += neutral

        # Average confidence
        confidences = [e["confidence"] for e in entries if e.get("confidence") is not None]
        avg_conf = round(sum(confidences) / len(confidences), 3) if confidences else None

        # Story type breakdown
        type_counts = {}
        for e in entries:
            st = e.get("story_type") or "other"
            type_counts[st] = type_counts.get(st, 0) + 1

        dominant_type = max(type_counts, key=type_counts.get) if type_counts else None

        # Last mention
        pub_dates = [e["published_at"] for e in entries if e.get("published_at")]
        last_mention = max(pub_dates) if pub_dates else None

        # Trend windows
        trend_7d = sum(
            1 for e in entries
            if e.get("published_at") and e["published_at"] >= cutoff_7d
        )
        trend_30d = sum(
            1 for e in entries
            if e.get("published_at") and e["published_at"] >= cutoff_30d
        )

        # Scores
        sentiment_score = compute_sentiment_score(positive, negative, neutral, total)
        buzz = compute_buzz_score(total, trend_7d, trend_30d)

        if buzz >= 15:
            stats["high_buzz"] += 1

        row_data = {
            "person_id": str(pid),
            "total_mentions": total,
            "positive_count": positive,
            "negative_count": negative,
            "neutral_count": neutral,
            "avg_confidence": float(avg_conf) if avg_conf else None,
            "sentiment_score": sentiment_score,
            "buzz_score": buzz,
            "story_types": json.dumps(type_counts),
            "dominant_type": dominant_type,
            "last_mention_at": last_mention.isoformat() if last_mention else None,
            "trend_7d": float(trend_7d),
            "trend_30d": float(trend_30d),
            "updated_at": now_iso,
        }
        upsert_rows.append(row_data)
        stats["processed"] += 1

    # Show sample
    if upsert_rows:
        sample = upsert_rows[0]
        print(f"\n  Sample (person_id={sample['person_id']}):")
        for key in ["total_mentions", "positive_count", "negative_count", "neutral_count",
                     "sentiment_score", "buzz_score", "dominant_type", "trend_7d", "trend_30d"]:
            print(f"    {key:20s}  {sample[key]}")

    # Global sentiment distribution
    total_tags = sum(sentiment_dist.values())
    if total_tags:
        print(f"\n  Sentiment distribution (all tags):")
        for s, c in sentiment_dist.items():
            pct = c / total_tags * 100
            print(f"    {s:10s}  {c:5d}  ({pct:.1f}%)")

    # Upsert
    n = chunked_upsert(upsert_rows)

    print(f"\n── Summary ───────────────────────────────────────────────────────")
    print(f"  Processed:   {stats['processed']}")
    print(f"  High buzz:   {stats['high_buzz']} players (score >= 15)")
    print(f"  Upserted:    {n}")
    if DRY_RUN:
        print("  (dry-run — no data was written)")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
