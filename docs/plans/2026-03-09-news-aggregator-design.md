# News Aggregator — Design

**Date**: 2026-03-09
**Status**: Approved
**Script**: `pipeline/12_news_ingest.py`

## Overview

RSS-based news aggregator that uses Gemini Flash to extract structured scouting intelligence from football articles, then links mentioned players to our `people` table.

## Pipeline Flow

1. **Fetch** — pull RSS feeds from ~15-20 sources
2. **Dedup** — skip URLs already in `news_stories` (unique constraint)
3. **Store raw** — insert with `processed = false`
4. **Gemini Flash** — for each unprocessed story, extract:
   - 1-2 sentence scouting summary
   - Story type (transfer, injury, performance, contract, disciplinary, tactical, other)
   - Players: name, club, nationality, role in story, sentiment (positive/negative/neutral), confidence (0-1)
5. **Match players** — fuzzy-match extracted names against `people` using name + club/nation filters
6. **Tag** — insert into `news_player_tags`
7. **Mark processed** — set `processed = true`, store full response in `gemini_raw`

## Schema

Existing tables from migration 003:
- `news_stories` — headline, summary, body, source, url (UNIQUE), published_at, processed, gemini_raw (jsonb)
- `news_player_tags` — story_id → news_stories, player_id → people, story_type, confidence

Additions needed:
- `news_stories.story_type` (text) — overall classification
- `news_player_tags.sentiment` (text) — positive/negative/neutral

## RSS Sources

**Transfer**: FootballTransfers.com, Fabrizio Romano (Guardian), Transfermarkt
**General**: BBC Sport, The Guardian Football, ESPN FC, Sky Sports
**League**: The Athletic, Marca, Kicker, Gazzetta dello Sport, L'Equipe
**Aggregators**: OneFootball, FourFourTwo

Stored as config dict. Quality tiers assigned later.

## CLI

```
python 12_news_ingest.py                    # full run
python 12_news_ingest.py --dry-run          # preview, no writes
python 12_news_ingest.py --fetch-only       # RSS only, skip Gemini
python 12_news_ingest.py --process-only     # process unprocessed stories
python 12_news_ingest.py --source bbc       # single source
python 12_news_ingest.py --limit 50         # cap articles per run
```

## Dependencies

- `feedparser` — RSS parsing
- `google-generativeai` — Gemini Flash API

## Cost

Gemini Flash ~$0.075/1M input tokens. ~100 articles/day ≈ $0.008/day.
