# News Aggregator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a news ingestion pipeline that scrapes RSS feeds, uses Gemini Flash to extract structured scouting intelligence, and links mentioned players to our `people` table.

**Architecture:** Script 12 fetches RSS → dedup by URL → store raw in `news_stories` → Gemini Flash extracts summary, story type, sentiment, and player mentions → fuzzy match player names against `people` table using name + club/nation → insert `news_player_tags`. Two-phase design: fetch-only and process-only modes for cron flexibility.

**Tech Stack:** Python, feedparser (RSS), google-generativeai (Gemini Flash), psycopg2 (DB), existing config.py

---

### Task 1: Schema Migration — Add Missing Columns

**Files:**
- Create: `pipeline/sql/005_news_columns.sql`

**Step 1: Write migration SQL**

```sql
-- 005_news_columns.sql — Add story_type to news_stories, sentiment to news_player_tags
ALTER TABLE news_stories ADD COLUMN IF NOT EXISTS story_type text;
ALTER TABLE news_player_tags ADD COLUMN IF NOT EXISTS sentiment text;

CREATE INDEX IF NOT EXISTS news_stories_source_idx ON news_stories(source);
CREATE INDEX IF NOT EXISTS news_stories_story_type_idx ON news_stories(story_type);
```

**Step 2: Apply migration**

Run via psycopg2 (no psql in Codespaces):
```bash
python3 -c "
import sys; sys.path.insert(0, 'pipeline')
from config import POSTGRES_DSN
import psycopg2
conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()
with open('pipeline/sql/005_news_columns.sql') as f:
    cur.execute(f.read())
print('Migration 005 applied')
cur.close(); conn.close()
"
```

**Step 3: Verify columns exist**

```bash
python3 -c "
import sys; sys.path.insert(0, 'pipeline')
from config import POSTGRES_DSN
import psycopg2
conn = psycopg2.connect(POSTGRES_DSN)
cur = conn.cursor()
cur.execute(\"SELECT column_name FROM information_schema.columns WHERE table_name = 'news_stories' AND column_name = 'story_type'\")
assert cur.fetchone(), 'story_type column missing'
cur.execute(\"SELECT column_name FROM information_schema.columns WHERE table_name = 'news_player_tags' AND column_name = 'sentiment'\")
assert cur.fetchone(), 'sentiment column missing'
print('OK: both columns exist')
cur.close(); conn.close()
"
```

**Step 4: Commit**

```bash
git add pipeline/sql/005_news_columns.sql
git commit -m "feat: migration 005 — add story_type and sentiment columns for news"
```

---

### Task 2: Add Dependencies + Config

**Files:**
- Modify: `pipeline/requirements.txt`
- Modify: `pipeline/config.py`

**Step 1: Add feedparser and google-generativeai to requirements**

Append to `pipeline/requirements.txt`:
```
feedparser>=6.0
google-generativeai>=0.8
beautifulsoup4>=4.12
lxml>=5.0
```

**Step 2: Add GEMINI_API_KEY to config.py**

Add after line 25 (`POSTGRES_DSN`):
```python
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
```

**Step 3: Install deps**

```bash
pip install feedparser google-generativeai beautifulsoup4 lxml
```

**Step 4: Commit**

```bash
git add pipeline/requirements.txt pipeline/config.py
git commit -m "feat: add feedparser + google-generativeai deps, GEMINI_API_KEY config"
```

---

### Task 3: Create Script 12 — RSS Fetcher (Phase 1)

**Files:**
- Create: `pipeline/12_news_ingest.py`

**Step 1: Write the RSS fetching layer**

The script should include:

1. **CLI args**: `--dry-run`, `--fetch-only`, `--process-only`, `--source <name>`, `--limit <n>`, `--force`
2. **RSS_SOURCES dict** with ~15-20 feeds:

```python
RSS_SOURCES = {
    # Transfer-focused
    "footballtransfers": {
        "url": "https://www.footballtransfers.com/en/transfer-news/feed",
        "category": "transfer",
    },
    "guardian_football": {
        "url": "https://www.theguardian.com/football/rss",
        "category": "general",
    },
    "bbc_sport": {
        "url": "https://feeds.bbci.co.uk/sport/football/rss.xml",
        "category": "general",
    },
    "skysports": {
        "url": "https://www.skysports.com/rss/12040",
        "category": "general",
    },
    "espn_fc": {
        "url": "https://www.espn.com/espn/rss/soccer/news",
        "category": "general",
    },
    "marca": {
        "url": "https://e00-marca.uecdn.es/rss/en/football.xml",
        "category": "league_esp",
    },
    "fourfourtwo": {
        "url": "https://www.fourfourtwo.com/feeds/all",
        "category": "general",
    },
    # Add more as discovered — URLs may need validation at runtime
}
```

Note: Some RSS URLs may be outdated or blocked. The script should gracefully skip failed feeds with a warning.

3. **Fetch loop**: for each source, `feedparser.parse(url)`, extract headline/summary/body/url/published_at
4. **Dedup**: skip if URL exists in `news_stories`
5. **Insert**: batch insert new stories with `processed = false`

**Step 2: Test fetch-only mode**

```bash
cd pipeline && python3 12_news_ingest.py --fetch-only --dry-run --limit 5
```

Expected: prints fetched articles without writing to DB.

**Step 3: Test real fetch-only**

```bash
cd pipeline && python3 12_news_ingest.py --fetch-only --limit 10
```

Expected: inserts up to 10 stories into `news_stories` with `processed = false`.

**Step 4: Verify in DB**

```bash
python3 -c "
import sys; sys.path.insert(0, 'pipeline')
from config import POSTGRES_DSN
import psycopg2
conn = psycopg2.connect(POSTGRES_DSN)
cur = conn.cursor()
cur.execute('SELECT count(*), count(*) FILTER (WHERE processed = false) FROM news_stories')
total, unprocessed = cur.fetchone()
print(f'news_stories: {total} total, {unprocessed} unprocessed')
cur.close(); conn.close()
"
```

**Step 5: Commit**

```bash
git add pipeline/12_news_ingest.py
git commit -m "feat: news ingest script 12 — RSS fetch phase"
```

---

### Task 4: Gemini Flash Processing (Phase 2)

**Files:**
- Modify: `pipeline/12_news_ingest.py`

**Step 1: Add Gemini processing function**

Add a function `process_story(headline, body)` that:

1. Calls Gemini Flash (`gemini-2.0-flash`) with this prompt structure:

```python
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
      "confidence": 0.0-1.0
    }}
  ]
}}

If no football players are mentioned, return {{"summary": "...", "story_type": "other", "players": []}}.
"""
```

2. Parse the JSON response
3. Return structured dict

**Step 2: Add player matching function**

Add `match_player(name, club, nationality)` that:

1. Query `people` table with `name ILIKE '%{name}%'`
2. If multiple matches, filter by club (join through `player_status` or check against known club names)
3. If still ambiguous, use nationality from `people.nation_id`
4. Return `people.id` or `None`

Use `psycopg2` directly (already connected).

**Step 3: Add processing loop**

After fetch phase, select all `WHERE processed = false`, run through Gemini, match players, insert tags.

**Step 4: Test process-only mode**

```bash
cd pipeline && python3 12_news_ingest.py --process-only --limit 5 --dry-run
```

Expected: shows Gemini responses and player matches without writing.

**Step 5: Test real processing**

```bash
cd pipeline && python3 12_news_ingest.py --process-only --limit 5
```

Expected: processes 5 stories, inserts player tags, marks as processed.

**Step 6: Verify**

```bash
python3 -c "
import sys; sys.path.insert(0, 'pipeline')
from config import POSTGRES_DSN
import psycopg2
conn = psycopg2.connect(POSTGRES_DSN)
cur = conn.cursor()
cur.execute('SELECT count(*) FROM news_stories WHERE processed = true')
print(f'Processed stories: {cur.fetchone()[0]}')
cur.execute('SELECT count(*) FROM news_player_tags')
print(f'Player tags: {cur.fetchone()[0]}')
cur.close(); conn.close()
"
```

**Step 7: Commit**

```bash
git add pipeline/12_news_ingest.py
git commit -m "feat: news ingest — Gemini Flash processing + player matching"
```

---

### Task 5: Makefile + CLAUDE.md + Final Polish

**Files:**
- Modify: `Makefile` — add `news` target
- Modify: `CLAUDE.md` — add script 12 docs, migration 005

**Step 1: Add Makefile target**

```makefile
news:
	cd $(PIPELINE) && $(PYTHON) 12_news_ingest.py
```

Add `news` to the `pipeline` chain.

**Step 2: Update CLAUDE.md**

Add to pipeline scripts section:
- `12_news_ingest.py` → RSS + Gemini Flash → `news_stories/news_player_tags`. Flags: `--source`, `--fetch-only`, `--process-only`, `--limit`, `--dry-run`, `--force`

Add migration 005 to external data tables.

**Step 3: Full end-to-end test**

```bash
cd pipeline && python3 12_news_ingest.py --limit 20
```

Expected: fetches RSS, dedup, Gemini processes, player tags inserted.

**Step 4: Commit**

```bash
git add Makefile CLAUDE.md
git commit -m "feat: news ingest — Makefile target + docs"
```

---

## Execution Notes

- RSS URLs may need tweaking — some feeds block non-browser user agents or have moved. The script should log warnings and continue.
- Gemini rate limits: Flash has generous limits but add a small delay (0.5s) between calls.
- Player matching is intentionally fuzzy for v1. We can refine with Levenshtein/trigram matching later.
- The `gemini_raw` jsonb column stores the full API response for debugging and future re-processing.
