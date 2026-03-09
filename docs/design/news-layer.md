# News Layer — Spec

## What it is
A news ingestion pipeline that pulls football news stories, uses Gemini to extract player references, and writes tagged stories to Supabase. Downstream: Scout Pad can surface news on a player card; Director game can generate inbox events from real news.

## Status
Approved — infancy. Free APIs only until proven useful.

---

## Supabase Schema

```sql
CREATE TABLE news_stories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline      text NOT NULL,
  summary       text,
  body          text,
  source        text,                          -- 'BBC Sport', 'Guardian', etc.
  url           text UNIQUE,
  published_at  timestamptz,
  ingested_at   timestamptz DEFAULT now(),
  processed     boolean DEFAULT false,         -- Gemini has run on it
  gemini_raw    jsonb                          -- raw Gemini response for debugging
);

CREATE TABLE news_player_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id    uuid REFERENCES news_stories(id) ON DELETE CASCADE,
  player_id   uuid REFERENCES players(id)      ON DELETE CASCADE,
  story_type  text,    -- 'transfer' | 'injury' | 'form' | 'contract' | 'debut' | 'personal'
  confidence  float,
  UNIQUE(story_id, player_id)
);

CREATE INDEX ON news_stories(processed);
CREATE INDEX ON news_stories(published_at DESC);
CREATE INDEX ON news_player_tags(player_id);
```

---

## Free News Sources

| Source | Method | Limit | Content |
|--------|--------|-------|---------|
| BBC Sport RSS | RSS fetch | Unlimited | Headlines + summaries |
| Sky Sports RSS | RSS fetch | Unlimited | Headlines + summaries |
| ESPN FC RSS | RSS fetch | Unlimited | Headlines + summaries |
| The Guardian API | REST API (free key) | 500 req/day | Full article text |
| GNews.io | REST API (free key) | 100 req/day | Headlines + descriptions |
| NewsAPI.org | REST API (free key) | 100 req/day | Headlines only (free tier) |
| Google News RSS | RSS fetch | Unlimited | Aggregated, no key needed |

**Recommended start:** BBC Sport + Sky Sports + Guardian RSS — zero auth, unlimited, reliable.
Guardian API for full text when needed (free developer key).

---

## Gemini Processing

Model: `gemini-2.0-flash` (free tier: 15 RPM, 1500 req/day, 1M tokens/day)

Prompt pattern:
```
Given this football news story, extract:
1. Player names mentioned (full name where possible)
2. Story type: transfer | injury | form | contract | debut | personal | other
3. Confidence 0.0–1.0 that each player is the subject (not incidental mention)

Return JSON: { "players": [{ "name": str, "story_type": str, "confidence": float }] }

Story: {headline}. {summary}
```

Then match returned names against `players.name` in Supabase (fuzzy match via `pg_trgm` or exact after normalisation).

---

## Pipeline Integration

New script: `chief-scout/pipeline/08_news_ingest.py`

```
1. Fetch RSS feeds → parse headlines + summaries + urls
2. Deduplicate against news_stories.url
3. Insert new stories (processed=false)
4. Batch unprocessed stories → Gemini API
5. Match player names → players table
6. Write news_player_tags rows
7. Mark stories processed=true
```

Run: add to `Makefile` as optional step or cron (hourly/daily).

---

## Paid Options (if free proves limiting)

| Service | Cost | Upgrade |
|---------|------|---------|
| NewsAPI.org Developer | $449/mo | Full text, 250k req/mo |
| The Athletic API | — | Not public yet |
| Sportradar | $$$ | Full sports data platform |
| Gemini 1.5 Pro | ~$3.50/1M tokens | Better entity extraction |

**Verdict:** Free RSS + Guardian API + Gemini Flash covers the use case well in infancy. Re-evaluate if volume or accuracy becomes an issue.

---

## Downstream Uses

- **Scout Pad**: "News" tab on player card — shows tagged stories for that player
- **Director game**: Inbox event generator — transfer rumours become chairman/manager messages
- **Transfer Availability**: news signals (injury, transfer interest) feed into availability score
