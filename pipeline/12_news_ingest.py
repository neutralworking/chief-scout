"""
12_news_ingest.py — News aggregation pipeline: RSS fetch + Gemini Flash processing.

Two-phase pipeline:
  Phase 1: Fetch RSS feeds, dedup by URL, insert into news_stories
  Phase 2: Process unprocessed stories with Gemini Flash, extract players, tag them

Usage:
    python 12_news_ingest.py                         # full run (fetch + process)
    python 12_news_ingest.py --fetch-only             # RSS fetch only
    python 12_news_ingest.py --process-only           # Gemini processing only
    python 12_news_ingest.py --dry-run                # preview without writing
    python 12_news_ingest.py --source bbc_football    # single feed
    python 12_news_ingest.py --limit 10               # cap items per feed / processing batch
    python 12_news_ingest.py --force                  # re-process already-processed stories
"""
import argparse
import json
import re
import sys
from datetime import datetime, timezone
from html import unescape as html_unescape

import feedparser
import psycopg2
from psycopg2.extras import execute_values

from config import POSTGRES_DSN

# ── CLI args ──────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="News ingest: RSS fetch + Gemini processing")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
parser.add_argument("--fetch-only", action="store_true", help="Only fetch RSS, skip processing")
parser.add_argument("--process-only", action="store_true", help="Only run Gemini processing")
parser.add_argument("--source", default=None, help="Single RSS source name to fetch")
parser.add_argument("--limit", type=int, default=None, help="Max items per feed (fetch) or batch size (process)")
parser.add_argument("--force", action="store_true", help="Re-process already-processed stories")
args = parser.parse_args()

DRY_RUN = args.dry_run
FETCH_ONLY = args.fetch_only
PROCESS_ONLY = args.process_only
LIMIT = args.limit
FORCE = args.force

# ── RSS Sources ───────────────────────────────────────────────────────────────

RSS_SOURCES = {
    "bbc_football": {
        "url": "https://feeds.bbci.co.uk/sport/football/rss.xml",
        "category": "general",
    },
    "guardian_football": {
        "url": "https://www.theguardian.com/football/rss",
        "category": "general",
    },
    "skysports_football": {
        "url": "https://www.skysports.com/rss/12040",
        "category": "general",
    },
    "espn_fc": {
        "url": "https://www.espn.com/espn/rss/soccer/news",
        "category": "general",
    },
    "fourfourtwo": {
        "url": "https://www.fourfourtwo.com/feeds/all",
        "category": "general",
    },
    "football_italia": {
        "url": "https://football-italia.net/feed/",
        "category": "league_ita",
    },
    "marca_en": {
        "url": "https://e00-marca.uecdn.es/rss/en/football.xml",
        "category": "league_esp",
    },
    "90min": {
        "url": "https://www.90min.com/posts.rss",
        "category": "general",
    },
    # ── Additional feeds (B9 expansion) ──────────────────────────────────
    "lequipe_football": {
        "url": "https://www.lequipe.fr/rss/actu_rss_Football.xml",
        "category": "league_fra",
    },
    "bild_fussball": {
        "url": "https://www.bild.de/rss-feeds/rss3-20telegraaf1-fussball-20telegraaf1-39542498,dzBildregion=,sortByDate=,teaserfall=.bild.xml",
        "category": "league_ger",
    },
    "gazzetta_football": {
        "url": "https://www.gazzetta.it/rss/Calcio.xml",
        "category": "league_ita",
    },
    "abola": {
        "url": "https://www.abola.pt/rss/index.aspx",
        "category": "league_por",
    },
    "as_football": {
        "url": "https://as.com/rss/en/football.xml",
        "category": "league_esp",
    },
    "rmc_sport": {
        "url": "https://rmcsport.bfmtv.com/rss/football/",
        "category": "league_fra",
    },
    "goal_com": {
        "url": "https://www.goal.com/feeds/en/news",
        "category": "general",
    },
    "teamtalk": {
        "url": "https://www.teamtalk.com/feed",
        "category": "general",
    },
    "football365": {
        "url": "https://www.football365.com/feed",
        "category": "general",
    },
    "kicker_football": {
        "url": "https://rss.kicker.de/news/fussball",
        "category": "league_ger",
    },
}

# ── Gemini prompt ─────────────────────────────────────────────────────────────

GEMINI_PROMPT = """You are a football scouting analyst. Analyze this news article and return structured JSON.

Article headline: {headline}
Article body: {body}

Return ONLY valid JSON with this structure:
{{
  "summary": "1-2 sentence scouting-relevant summary",
  "story_type": "transfer|injury|performance|contract|disciplinary|tactical|other",
  "players": [
    {{
      "name": "Full player name",
      "club": "Current club if mentioned",
      "nationality": "If mentioned",
      "role_in_story": "Brief description of why they're mentioned",
      "sentiment": "positive|negative|neutral",
      "confidence": 0.95
    }}
  ]
}}

If no football players are mentioned, return {{"summary": "...", "story_type": "other", "players": []}}.
"""

# ── DB connection ─────────────────────────────────────────────────────────────

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# ── Helpers ───────────────────────────────────────────────────────────────────

TAG_RE = re.compile(r"<[^>]+>")


def strip_html(text: str) -> str:
    """Remove HTML tags and decode entities."""
    if not text:
        return ""
    text = TAG_RE.sub("", text)
    text = html_unescape(text)
    return text.strip()


def parse_published(entry) -> datetime | None:
    """Parse published date from a feedparser entry."""
    for attr in ("published_parsed", "updated_parsed"):
        parsed = getattr(entry, attr, None)
        if parsed:
            try:
                return datetime(*parsed[:6], tzinfo=timezone.utc)
            except Exception:
                pass
    # Try string parsing as fallback
    for attr in ("published", "updated"):
        raw = getattr(entry, attr, None)
        if raw:
            try:
                return datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except Exception:
                pass
    return None


# ── Phase 1: RSS Fetch ───────────────────────────────────────────────────────

def fetch_rss():
    """Fetch RSS feeds and insert new stories into news_stories."""
    sources = RSS_SOURCES
    if args.source:
        if args.source not in RSS_SOURCES:
            print(f"ERROR: unknown source '{args.source}'. Available: {', '.join(RSS_SOURCES.keys())}")
            sys.exit(1)
        sources = {args.source: RSS_SOURCES[args.source]}

    # Load existing URLs for dedup
    cur.execute("SELECT url FROM news_stories WHERE url IS NOT NULL")
    existing_urls = {row[0] for row in cur.fetchall()}
    print(f"Existing stories in DB: {len(existing_urls)}")

    total_new = 0
    total_skipped = 0

    for source_name, source_cfg in sources.items():
        feed_url = source_cfg["url"]
        print(f"\n── {source_name}: {feed_url}")

        try:
            feed = feedparser.parse(feed_url)
        except Exception as e:
            print(f"  WARN: failed to parse feed: {e}")
            continue

        # feedparser doesn't raise on HTTP errors; check bozo + status
        if feed.bozo and not feed.entries:
            print(f"  WARN: feed error ({getattr(feed, 'bozo_exception', 'unknown')}), skipping")
            continue

        status = getattr(feed, "status", None)
        if status and status >= 400:
            print(f"  WARN: HTTP {status}, skipping")
            continue

        entries = feed.entries
        if not entries:
            print(f"  WARN: no entries found, skipping")
            continue

        if LIMIT:
            entries = entries[:LIMIT]

        new_stories = []
        skipped = 0

        for entry in entries:
            url = getattr(entry, "link", None)
            if not url:
                continue

            # Dedup
            if url in existing_urls:
                skipped += 1
                continue

            headline = strip_html(getattr(entry, "title", ""))
            if not headline:
                continue

            # Body: try content first, then summary
            body = ""
            if hasattr(entry, "content") and entry.content:
                body = strip_html(entry.content[0].get("value", ""))
            if not body:
                body = strip_html(getattr(entry, "summary", ""))

            published_at = parse_published(entry)

            new_stories.append((
                headline,
                None,  # summary — filled by Gemini later
                body,
                source_name,
                url,
                published_at,
                False,  # processed
            ))
            existing_urls.add(url)  # prevent dupes within same run

        if new_stories:
            if DRY_RUN:
                print(f"  [dry-run] would insert {len(new_stories)} new stories (skipped {skipped} dupes)")
            else:
                execute_values(cur, """
                    INSERT INTO news_stories (headline, summary, body, source, url, published_at, processed)
                    VALUES %s
                    ON CONFLICT (url) DO NOTHING
                """, new_stories)
                print(f"  Inserted {len(new_stories)} new stories (skipped {skipped} dupes)")
        else:
            print(f"  No new stories (skipped {skipped} dupes)")

        total_new += len(new_stories)
        total_skipped += skipped

    print(f"\n── Fetch summary: {total_new} new, {total_skipped} skipped")
    if DRY_RUN:
        print("  (dry-run — no data was written)")


# ── Phase 2: LLM Processing (via router) ─────────────────────────────────────


def _unaccent(text: str) -> str:
    """Strip diacritics for accent-insensitive matching."""
    import unicodedata
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def match_player(name: str, club: str | None = None, nationality: str | None = None) -> int | None:
    """
    Try to match a player name to people.id.
    Strategy: exact → contains → unaccent → last-name, each narrowed by club if ambiguous.
    """
    if not name:
        return None

    def _narrow_by_club(rows):
        """If multiple matches, try to narrow by club name."""
        if len(rows) <= 1 or not club:
            return rows
        cur.execute("""
            SELECT p.id, p.name FROM people p
            LEFT JOIN clubs c ON c.id = p.club_id
            WHERE p.id = ANY(%s) AND c.clubname ILIKE %s
        """, ([r[0] for r in rows], f"%{club}%"))
        club_rows = cur.fetchall()
        return club_rows if club_rows else rows

    # All queries use unaccent() for accent-insensitive matching
    # (Džeko matches Dzeko, Mbappé matches Mbappe, etc.)

    # 1. Exact match (accent-insensitive)
    cur.execute("SELECT id, name FROM people WHERE unaccent(name) ILIKE unaccent(%s)", (name,))
    rows = cur.fetchall()
    if len(rows) == 1:
        return rows[0][0]
    if rows:
        narrowed = _narrow_by_club(rows)
        if len(narrowed) == 1:
            return narrowed[0][0]

    # 2. Contains match — "Messi" matches "Lionel Messi", "Dzeko" matches "Edin Džeko"
    cur.execute("SELECT id, name FROM people WHERE unaccent(name) ILIKE unaccent(%s)", (f"%{name}%",))
    rows = cur.fetchall()
    if len(rows) == 1:
        return rows[0][0]
    if rows:
        narrowed = _narrow_by_club(rows)
        if len(narrowed) == 1:
            return narrowed[0][0]
        # Prefer names ending with the search term
        ascii_name = _unaccent(name).lower()
        for r in narrowed:
            if _unaccent(r[1]).lower().endswith(ascii_name) or _unaccent(r[1]).lower() == ascii_name:
                return r[0]

    # 3. Last-name only match
    parts = name.strip().split()
    if len(parts) >= 2:
        last_name = parts[-1]
        cur.execute("SELECT id, name FROM people WHERE unaccent(name) ILIKE unaccent(%s)", (f"% {last_name}",))
        rows = cur.fetchall()
        if len(rows) == 1:
            return rows[0][0]
        if rows:
            narrowed = _narrow_by_club(rows)
            if len(narrowed) == 1:
                return narrowed[0][0]

    return None


def process_stories():
    """Process unprocessed stories with LLM router (auto-fallback across providers)."""
    from lib.llm_router import LLMRouter

    router = LLMRouter(verbose=True)
    if not router.available_providers():
        print("ERROR: No LLM providers configured. Set GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY")
        sys.exit(1)

    print(f"  LLM providers: {', '.join(router.available_providers())}")

    where = "WHERE processed = false"
    if FORCE:
        where = ""  # re-process all

    limit_clause = f"LIMIT {LIMIT}" if LIMIT else ""

    cur.execute(f"""
        SELECT id, headline, body FROM news_stories
        {where}
        ORDER BY ingested_at ASC
        {limit_clause}
    """)
    stories = cur.fetchall()

    if not stories:
        print("No stories to process.")
        return

    print(f"Processing {len(stories)} stories...")

    processed_count = 0
    tagged_count = 0

    for idx, (story_id, headline, body) in enumerate(stories, 1):
        print(f"\n  [{idx}/{len(stories)}] {headline[:80]}...")

        prompt = GEMINI_PROMPT.format(headline=headline, body=(body or "")[:3000])
        llm_result = router.call(prompt, json_mode=True)

        if llm_result is None or llm_result.parsed is None:
            print(f"    SKIP — no valid response")
            continue

        result = llm_result.parsed
        summary = result.get("summary", "")
        story_type = result.get("story_type", "other")
        players = result.get("players", [])

        if DRY_RUN:
            print(f"    [dry-run] type={story_type}, players={len(players)}")
            for p in players:
                pid = match_player(p.get("name"), p.get("club"), p.get("nationality"))
                print(f"      {p.get('name')} → people.id={pid}")
            processed_count += 1
            continue

        # Update the story
        cur.execute("""
            UPDATE news_stories
            SET summary = %s, story_type = %s, gemini_raw = %s, processed = true
            WHERE id = %s
        """, (summary, story_type, json.dumps(result), story_id))

        # Tag players
        for p in players:
            player_name = p.get("name", "")
            if not player_name:
                continue

            pid = match_player(player_name, p.get("club"), p.get("nationality"))
            if pid is None:
                print(f"    player '{player_name}' — no match in people table")
                continue

            confidence = p.get("confidence", 0.5)
            sentiment = p.get("sentiment", "neutral")

            try:
                cur.execute("""
                    INSERT INTO news_player_tags (story_id, player_id, story_type, confidence, sentiment)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (story_id, player_id) DO UPDATE SET
                        story_type = EXCLUDED.story_type,
                        confidence = EXCLUDED.confidence,
                        sentiment = EXCLUDED.sentiment
                """, (story_id, pid, story_type, confidence, sentiment))
                tagged_count += 1
                print(f"    tagged: {player_name} → people.id={pid}")
            except Exception as e:
                print(f"    WARN: failed to tag {player_name}: {e}")

        processed_count += 1

    router.print_stats()
    print(f"\n── Processing summary: {processed_count} stories processed, {tagged_count} player tags created")
    if DRY_RUN:
        print("  (dry-run — no data was written)")


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("News Ingest Pipeline")
    print(f"  dry-run: {DRY_RUN}")
    if FETCH_ONLY:
        print("  mode: fetch-only")
    elif PROCESS_ONLY:
        print("  mode: process-only")
    else:
        print("  mode: full (fetch + process)")
    print()

    try:
        if not PROCESS_ONLY:
            fetch_rss()

        if not FETCH_ONLY:
            print()
            process_stories()
    finally:
        cur.close()
        conn.close()

    print("\nDone.")
