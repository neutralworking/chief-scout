# Data Sanitation & Enrichment Plan

## Context

Chief Scout has ~524 players with partial coverage across 6 core tables. Only ~21 have complete structured profiles. Current pipeline pulls from StatsBomb (open data), Understat (6 leagues), FBRef (manual HTML save), Wikidata (SPARQL), Transfermarkt (weekly CSV), and RSS+Gemini for news. Key gaps: no pre-write validation layer (BACKLOG #10, RISKS R13), personality/archetype coverage is thin outside 50 seeded players, defensive stats require manual FBRef workflow, and no contract/injury/salary data exists.

Priority 1 is getting the data clean and rich enough to promote more players to Tier 1 (production-ready).

---

## A. Data Sanitation (Clean What We Have)

### A1. Pre-Write Validation Layer (Build It) ✅

- **Cost:** Free (engineering time only)
- **What:** Add field-level validation before every Supabase upsert — type checks, range enforcement (grades 0-20, MBTI 0-100), required field checks, format validation (DOB, height_cm)
- **Where:** New `pipeline/validation.py` shared across all scripts
- **Impact:** Fixes R13, prevents garbage propagation
- **Effort:** S-M
- **Status:** Done — `pipeline/validation.py` with validators for all 6 feature tables, enforcing SACROSANCT enums

### A2. Deduplication & Merge Improvements

- **Cost:** Free
- **What:** Upgrade from name-slug matching to composite key (name + DOB + club). Add Levenshtein/Jaro-Winkler fuzzy matching with confidence scores. Flag ambiguous matches for manual review instead of auto-merging
- **Where:** `pipeline/10_player_matching.py`, `pipeline/36_data_cleanup.py`
- **Impact:** Fixes R12 (name collision risk)
- **Effort:** M

### A3. Automated Data Quality Dashboard

- **Cost:** Free
- **What:** Extend admin `/admin` page with per-field completeness heatmap, stale data flags (last updated > 90 days), cross-source consistency checks (StatsBomb vs Understat vs FBRef for same player)
- **Where:** `apps/player-editor/src/app/admin/`
- **Impact:** Makes gaps visible, prioritises enrichment work
- **Effort:** M

---

## B. Free Enrichment Sources

### B1. Wikidata (Already Integrated — Expand) ✅ Partially

- **Current:** Scripts 15, 17, 18, 19 pull identity, clubs, career, nationality
- **Expand to:** P413 (position played — raw labels need mapping), P1532 (country for sport — disambiguates international career), P6509 (total goals) ✅, P555 (military branch — for older/historical players), P166 (awards — Ballon d'Or, Golden Boot detection) ✅
- **Cost:** Free, rate-limited (5s backoff on 429)
- **Effort:** S per new property

### B2. StatsBomb Open Data (Already Integrated — Maximise)

- **Current:** Script 08 ingests competitions/matches/events
- **Gap:** Only ~15 competitions in open data (women's Super League, select men's). No EPL/La Liga/Bundesliga
- **Action:** Ensure all available open competitions are ingested. Extract more granular event metrics (progressive carries, pressure events, shot-creating actions)
- **Cost:** Free
- **Effort:** S

### B3. Understat (Already Integrated — Stable)

- **Coverage:** EPL, La Liga, Bundesliga, Serie A, Ligue 1, RFPL
- **Gap:** No defensive metrics, no Eredivisie/Primeira Liga
- **Action:** Already well-utilised. No further expansion possible without new leagues being added by Understat
- **Cost:** Free

### B4. FBRef / Football Reference (Already Integrated — Automate)

- **Current:** Manual HTML/CSV save from browser (FBRef blocks scraping)
- **Improvement options:**
    - Use Playwright/Puppeteer with respectful rate limits to automate saves
    - Use the FBRef CDN CSV exports (some tables available as CSV download)
    - Parse the shtml pages server-side with rotating user agents
- **Risk:** FBRef ToS prohibits scraping. Could get IP banned
- **Cost:** Free (but ToS risk)
- **Effort:** M

### B5. Transfermarkt (Already Integrated via dcaribou dataset) ✅ Partially

- **Current:** Script 25 uses dcaribou/transfermarkt-datasets (weekly CSV refresh)
- **Expand to:** Contract expiry dates ✅, agent info ✅, injury history (all available in the dataset)
- **Cost:** Free
- **Effort:** S

### B6. Wikipedia / DBpedia

- **What:** Supplement Wikidata with structured biographical data, career summaries, honours lists
- **How:** DBpedia SPARQL endpoint or Wikipedia API for player infoboxes
- **Useful for:** Honours, international caps, career milestones not in Wikidata
- **Cost:** Free
- **Effort:** S-M

### B7. OpenFootball / football-data.org

- **What:** Open-source football data — fixtures, results, league tables
- **Useful for:** Context data (league standings, match results) rather than player-level stats
- **Cost:** Free
- **Effort:** S

### B8. Sofascore / Fotmob (Web Scraping)

- **What:** Player ratings, heatmaps, match statistics
- **How:** Reverse-engineer API endpoints (both have public-facing JSON APIs used by their apps)
- **Risk:** No official API, could break. ToS issues
- **Useful for:** Match ratings, momentum data, shot maps
- **Cost:** Free (but fragile)
- **Effort:** M-L

### B9. Expand News Sources ✅

- **Current:** 8 RSS feeds (English/Spanish only)
- **Expand to:** L'Equipe ✅, Bild ✅, A Bola ✅, Goal.com ✅, TeamTalk ✅, Football365 ✅, De Telegraaf, The Athletic RSS, Twitter/X lists via RSS bridges
- **Cost:** Free (Gemini Flash API cost is minimal)
- **Effort:** S

---

## C. Paid Enrichment Sources

### C1. StatsBomb Full API

- **What:** Complete event data for all major leagues, 360 freeze-frame data, advanced metrics
- **Coverage:** 50+ leagues, historical data back to 2000s
- **Pricing:** Enterprise — typically $10k-50k/year depending on leagues/features
- **Value:** Gold standard for event data. Would fill the biggest single gap (no EPL/La Liga event data currently)
- **Effort:** S (already have ingestion pipeline, just switch API endpoint)

### C2. Opta / Stats Perform

- **What:** Industry standard for match facts, player stats, live data feeds
- **Coverage:** 100+ leagues globally
- **Pricing:** Enterprise — $20k-100k+/year
- **Value:** Most comprehensive, but expensive. Used by every major club and broadcaster
- **Effort:** M (new ingestion pipeline needed)

### C3. Wyscout

- **What:** Video scouting platform with statistical data, player comparison, market values
- **Coverage:** 200+ leagues, video clips for every event
- **Pricing:** ~$1k-5k/year for data API access (individual/small org tier)
- **Value:** Strong for scouting workflows — combines video + data. API available
- **Effort:** M (new pipeline)

### C4. InStat

- **What:** Detailed match analysis, player performance indices, tactical data
- **Coverage:** 100+ leagues
- **Pricing:** ~$2k-10k/year
- **Value:** Good tactical/positional data, less common than Opta/StatsBomb
- **Effort:** M

### C5. Transfermarkt API (Official)

- **What:** Direct API access to market values, transfer history, contract details, injury records
- **Coverage:** Comprehensive (100k+ players)
- **Pricing:** ~$500-2k/month (RapidAPI marketplace)
- **Value:** Already using free CSV mirror — official API adds real-time updates, injury data, contract details
- **Effort:** S (replace CSV download with API calls)

### C6. SofaScore API (Official)

- **What:** Match ratings, player statistics, live scores
- **Pricing:** ~$200-500/month via RapidAPI
- **Value:** Good supplementary ratings data
- **Effort:** S

### C7. Football-Data.co.uk / Betting Odds Data

- **What:** Historical betting odds, match results, league data
- **Cost:** Free CSV downloads, paid API for live data (~$50/month)
- **Value:** Useful for market value correlation, match prediction features
- **Effort:** S

### C8. Gemini/Claude for Profile Generation

- **What:** Use LLMs to generate/enrich scouting narratives, personality assessments, blueprint descriptions from existing stat data
- **Current:** Already using Gemini Flash for news processing
- **Expand to:** Auto-generate blueprint text, scouting notes, archetype rationale from attribute grades
- **Cost:** ~$10-50/month at current volume (Gemini Flash is cheap)
- **Value:** Could rapidly fill the personality/blueprint gap for 500+ players
- **Effort:** M

---

## D. Recommended Priority Order

### Phase 1: Clean + Automate (Free / ~$5, 1-2 weeks)

1. A1 — Validation layer (prevents new garbage) ✅
2. A2 — Dedup improvements (fixes existing garbage)
3. F3 — Activate Groq for batch processing (already have API key)
4. F9 — GitHub Actions for scheduled pipeline runs ✅
5. B9 — Expand news RSS (quick win, more coverage) ✅

### Phase 2: LLM-Powered Enrichment (Free-$10, 2-3 weeks)

6. G1 — Batch profile generator via Gemini Flash (~$2-5 for 500 players)
7. G2 — Personality inference via Gemini Pro/Haiku (~$3-10)
8. G3 — Smart name matching via Groq/Llama (free tier)
9. B5 — Expand Transfermarkt dataset (contract/injury data) ✅ Contract + agent done
10. B1 — Expand Wikidata properties (awards, goals) ✅
11. F7 — Parallel pipeline execution (3-5x speedup)

### Phase 3: Quality + Dashboard (Free, 1 week)

12. G4 — LLM data quality auditor
13. A3 — Data quality dashboard
14. B2 — Maximise StatsBomb open data extraction

### Phase 4: Strategic Paid Investment (When Revenue Justifies)

15. C5 — Transfermarkt official API ($500-2k/mo) — best value per dollar
16. C3 — Wyscout ($1-5k/yr) — scouting-focused, reasonable price
17. C1 — StatsBomb full API ($10-50k/yr) — when you need event data at scale

**Total Cost to Reach Phase 3: ~$5-20 in API tokens**

---

## E. Quick Wins (Can Do Today) ✅

All implemented on branch `claude/resume-data-sanitation-48Yro`.

### E1. Wikidata Goals + Awards Enrichment ✅

- **What:** Added P6509 (total career goals) and P166 (awards — Ballon d'Or, Golden Boot, etc.) to `19_wikidata_deep_enrich.py`
- **Impact:** Instantly enriches identity data for every player with a Wikidata ID. Awards data enables Ballon d'Or contention tagging (BACKLOG #3)
- **Migration:** `020_goals_awards_contract.sql` adds `total_goals` (integer) and `awards` (jsonb) columns to `people`
- **Run:** `python 19_wikidata_deep_enrich.py --phase identity --limit 200`

### E2. Expand News RSS from 8 → 14 Sources ✅

- **What:** Added 6 new feeds to `12_news_ingest.py`: L'Equipe (Ligue 1), Bild (Bundesliga), A Bola (Primeira Liga), Goal.com, TeamTalk, Football365
- **Impact:** ~75% more news coverage, adds French/German/Portuguese language sources. Gemini Flash handles multilingual extraction
- **Run:** `python 12_news_ingest.py --fetch-only` to test new feeds

### E3. Contract Expiry + Agent from Transfermarkt ✅

- **What:** `25_transfermarkt_ingest.py` now extracts `contract_expiration_date` and `agent_name` from the dcaribou CSV dataset (if fields present), writes to `people` table
- **Impact:** Enables contract-based scouting filters ("expiring in 6 months"), agent clustering, free transfer detection
- **Migration:** `020_goals_awards_contract.sql` adds `contract_expiry_date` (date, indexed) and `agent_name` (text) to `people`
- **Run:** `python 25_transfermarkt_ingest.py --dry-run` to check field availability

### E4. Dead Code Cleanup ✅

- **What:** Removed unused `GROQ_API_KEY` import from `12_news_ingest.py` (imported but never referenced)
- **Impact:** Cleaner dependency graph, no functional change

### E5. GitHub Actions for Scheduled Pipeline ✅

- **What:** New `.github/workflows/pipeline-scheduled.yml` with:
    - **Daily (06:00 UTC):** News ingest (`12_news_ingest.py --limit 50`)
    - **Weekly (Sunday 03:00 UTC):** Wikidata enrichment + Transfermarkt refresh + data quality audit
    - **Manual dispatch:** Run any combination of `news`, `wikidata`, `transfermarkt`, `data-quality` with optional dry-run
- **Impact:** Replaces manual pipeline runs. News stays fresh, data quality monitored continuously
- **Setup required:** Add `POSTGRES_DSN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GEMINI_API_KEY` to GitHub repo secrets

### E6. Comprehensive Data Sanitizer ✅

- **What:** New `pipeline/37_data_sanitize.py` — 8-section audit covering all 6 feature tables:
    1. Identity sanitation (names, DOB, height, foot, duplicates)
    2. Profile sanitation (positions, levels, archetypes)
    3. Personality sanitation (dimension ranges, trait ranges)
    4. Market sanitation (negative values, tier consistency)
    5. Attribute grade sanitation (scale validation, source distribution)
    6. Status sanitation (enum validation, garbage bio detection)
    7. Cross-table referential integrity
    8. Enrichment gap report with Tier 1 promotion readiness scoring
- **Modes:** `--audit` (report only), `--fix` (auto-fix safe issues), `--enrich` (gap analysis), `--dry-run`
- **Run:** `python 37_data_sanitize.py --audit --enrich` for full picture

### E7. Pre-Insert Validation Framework ✅

- **What:** New `pipeline/validation.py` — reusable validators for `people`, `player_profiles`, `player_personality`, `player_market`, `player_status`, `attribute_grades`
- **Impact:** Any pipeline script can now call `validate_row("people", data)` before writing. Returns structured errors + warnings. Enforces all SACROSANCT enums
- **Usage:** `from validation import validate_row, validate_batch`

### E8. Extended Data Integrity Tests ✅

- **What:** Added ~20 new pytest tests to `pipeline/tests/test_data_integrity.py`:
    - `TestIdentityData` — empty/garbage/whitespace names, DOB range, height range, foot enum, accent duplicates
    - `TestStatusData` — all 6 tag enums + garbage scouting notes
    - `TestLevelSanity` — level/peak/overall ranges, archetype_confidence enum
    - `TestCrossTableCoverage` — FK integrity for status, no duplicate records in any feature table
- **Run:** `python -m pytest tests/test_data_integrity.py -v`

### Migration Checklist

Before running the new scripts, apply the migration:

```sql
psql $POSTGRES_DSN -f pipeline/sql/020_goals_awards_contract.sql
```

This adds 4 columns to `people`: `total_goals`, `awards`, `contract_expiry_date`, `agent_name`.

---

## F. Free & Cheap Compute / LLM Power for Pipeline Acceleration

### F1. Google Gemini Flash (Already Using — Scale Up)

- **Current:** Used in `12_news_ingest.py` for news entity extraction + sentiment
- **Expand to:** Batch profile generation, archetype inference, blueprint writing, scouting note synthesis
- **Cost:** Gemini 2.0 Flash — free tier: 15 RPM / 1M TPD. Paid: ~$0.10/1M input tokens, $0.40/1M output tokens
- **At 524 players:** ~$0.50-2.00 total for full profile generation pass
- **Best for:** High-volume, structured extraction tasks (JSON mode is reliable)

### F2. Gemini 2.5 Pro (Preview — Free While in Preview)

- **What:** Google's most capable model, currently free during preview period
- **Cost:** Free (rate-limited: 5 RPM). Paid when GA: ~$1.25/1M input, $10/1M output
- **Best for:** Complex scouting assessments, nuanced archetype reasoning, personality inference from career data
- **How:** Swap model ID in Gemini API calls, use for quality-critical tasks (personality typing, blueprint generation)
- **Risk:** Preview may end, pricing TBD

### F3. Groq (Already Configured — Underused)

- **Current:** `GROQ_API_KEY` exists in env, referenced as fallback in news pipeline
- **What:** Ultra-fast inference on open models (Llama 3.3 70B, Mixtral, Gemma 2)
- **Cost:** Free tier: 30 RPM, 14.4k tokens/min. Paid: ~$0.59/1M tokens (Llama 3.3 70B)
- **Best for:** High-throughput batch processing — validation, name matching, entity extraction
- **Speed:** 500+ tokens/sec, fastest inference API available
- **Effort:** S — already have API key, just add to pipeline scripts

### F4. Claude API (Haiku 4.5 for Batch, Sonnet for Quality)

- **What:** Anthropic's models via API
- **Cost:** Haiku 4.5: $0.80/1M input, $4/1M output. Sonnet: $3/1M input, $15/1M output
- **Batch API:** 50% discount on all models for non-real-time workloads (24hr SLA)
- **Best for:** High-quality scouting narratives, personality assessment, complex reasoning about player data
- **At 524 players with batch:** ~$2-8 total for Haiku, ~$8-30 for Sonnet
- **Effort:** S-M

### F5. Ollama / Local LLMs (Free, No Rate Limits)

- **What:** Run Llama 3.3, Mistral, Qwen locally — zero API cost, no rate limits
- **Requirements:** GPU recommended (8GB+ VRAM for 7B models, 16GB+ for 70B quantized)
- **Best for:** Iterative development, unlimited retries, sensitive data processing
- **Models:** Llama 3.3 8B (fast, good for extraction), Qwen 2.5 32B (strong reasoning), Mistral Small 24B
- **Cost:** Free (electricity + hardware)
- **Effort:** M (setup Ollama, integrate with pipeline)

### F6. Together.ai / Fireworks.ai (Cheap Open Model Hosting)

- **What:** Hosted open-source models with pay-per-token pricing
- **Cost:** Llama 3.3 70B: ~$0.60-0.90/1M tokens. Mixtral 8x22B: ~$1.20/1M tokens
- **Best for:** When you need more throughput than Groq free tier but don't want to run local
- **Effort:** S (API-compatible with OpenAI SDK)

### F7. Parallel Pipeline Execution

- **What:** Run pipeline scripts concurrently instead of sequentially
- **Current:** `make pipeline` runs scripts in order. Many are independent (news, stats, wikidata)
- **How:** asyncio or multiprocessing for batch Supabase upserts. GNU parallel for independent scripts
- **Cost:** Free
- **Impact:** 3-5x speedup on full pipeline runs
- **Effort:** S-M

### F8. Supabase Edge Functions (Free Tier Compute)

- **What:** Deno-based serverless functions running on Supabase infrastructure
- **Cost:** Free: 500k invocations/month, 2M edge function invocations
- **Best for:** Lightweight data transforms, webhook-triggered enrichment, scheduled jobs
- **Example:** Trigger enrichment when a new player is inserted (database webhook → edge function → Wikidata lookup)
- **Effort:** M

### F9. GitHub Actions (Free CI/CD Compute) ✅

- **What:** 2,000 minutes/month free for private repos, unlimited for public
- **Best for:** Scheduled pipeline runs (daily/weekly), automated data quality checks
- **How:** Cron-triggered workflows that run pipeline scripts, push results to Supabase
- **Current gap:** Pipeline runs manually or via Vercel cron (news only)
- **Cost:** Free (within limits)
- **Effort:** S
- **Status:** Done — `.github/workflows/pipeline-scheduled.yml`

---

## G. LLM-Powered Pipeline Enhancements (What to Build)

### G1. Batch Profile Generator (`33_gemini_profiles.py`) — EXISTS, BLOCKED

- **Input:** Player's attribute grades + career history + news sentiment
- **Output:** Level (1-99), scouting bio, per club batch
- **Model:** Gemini Flash (cheap) with Sonnet/Pro fallback for edge cases
- **Approach:** Structured JSON output with SACROSANCT-compliant archetypes
- **Target:** Fill scouting_notes for 500+ players in one run (~$2-5)
- **Status:** Script exists. Blocked on Gemini free tier quota (limit: 0 RPM as of 2026-03-13). Needs paid tier or multi-provider fallback
- **Existing scripts:** `33_gemini_profiles.py` (levels + bios), `35_manual_profiles.py` (DOF curated, 267 applied)

### G2. Personality Inference — CRITICAL PATH

- **Input:** Career trajectory (loyalty/mobility), news sentiment, playing style attributes
- **Output:** MBTI dimension scores (ei/sn/tf/jp), competitiveness, coachability
- **Model:** Gemini Pro or Claude Haiku (needs reasoning about personality)
- **Validation:** Cross-check against 104 existing personality records for calibration
- **Target:** Fill personality for 500+ players (~$3-10)
- **Status:** Only 104 personality records exist (from seed + DOF). This is the #1 north star blocker
- **Existing script:** `32_dof_profiles.py` covers 98 seed players only

### G3. Blueprint Generator — CRITICAL PATH

- **Input:** Attribute grades (9,445 players have 20+), position, archetype
- **Output:** Blueprint text (e.g. "Maestro", "Pressing Machine", "Ball-Playing Defender")
- **Model:** Any LLM — structured classification from attribute profile
- **Target:** Fill blueprint for 4,700+ players who have archetype but no blueprint
- **Status:** Only 49 blueprints exist. 4,772 archetypes exist. Gap is massive
- **Could be deterministic:** Blueprint could be derived from archetype + top attributes without LLM

### G4. Smart Name Matching (`pipeline/lib/llm_match.py`)

- **Input:** Unmatched player name + club + nationality from external source
- **Output:** Best match from people table or "no match" with confidence
- **Model:** Groq/Llama (fast, cheap) — handles transliteration, nicknames, accent variations
- **Target:** Resolve 30+ currently unmatched players across sources

### G5. Data Quality Auditor

- **Input:** Full player record across all 6 tables
- **Output:** Quality score (0-100), list of suspicious values, suggested corrections
- **Model:** Gemini Flash (structured output)
- **Run:** As post-pipeline validation step, flags records for human review
- **Target:** Catch the ~5-10% of records with plausible-but-wrong data

---

## H. North Star Gap Analysis (as of 2026-03-13)

Full profile = people + profiles + personality + market + status + 20+ attribute grades.

| Table | Rows | North Star Requirement | Gap |
|---|---|---|---|
| `people` | 20,180 | name, DOB, height, foot, nation, club | Mostly populated |
| `player_profiles` | 19,335 | position, archetype, blueprint, level, overall | **blueprint: only 49** (archetype: 4,772) |
| `player_personality` | **104** | MBTI scores + competitiveness + coachability | **Critical: only 104/20,180** |
| `player_market` | 19,473 | market_value_tier, true_mvt, scarcity_score | Mostly populated |
| `player_status` | varies | pursuit_status, scouting_notes | **scouting_notes: 1,720** |
| `attribute_grades` | 9,445 with 20+ | 20+ grades per player | Good coverage |

### What's Actually Blocking Tier 1?

**49 players** currently qualify as full profiles. To hit 200+:

1. **Personality (104 → 500+)** — biggest gap, needs LLM or heuristic inference
2. **Blueprint (49 → 500+)** — could be deterministic from archetype + attributes
3. **Scouting notes (1,720 → fine)** — already decent, Gemini can fill rest
4. **Archetype (4,772 → fine)** — good coverage
5. **Market data (19,473 → fine)** — already populated

### Fastest Path to 200+ Full Profiles

| Step | Script | Action | Impact |
|---|---|---|---|
| 1 | New `38_infer_personality.py` | Heuristic personality from attributes + career | 104 → 2,000+ |
| 2 | New `39_infer_blueprints.py` | Deterministic blueprint from archetype + top attributes | 49 → 4,000+ |
| 3 | `33_gemini_profiles.py` | Fill scouting notes (needs Gemini paid or fallback) | 1,720 → 3,000+ |
| 4 | `40_promote_to_prod.py --dry-run` | Check how many now qualify | Target: 200+ |

Steps 1-2 are **free, no LLM needed**, and could push north star from 49 → 200+ today.

---

## I. Multi-Provider LLM Strategy

Gemini free tier is unreliable (quota exhausts quickly, limit drops to 0 RPM). Pipeline scripts need fallback chains.

### Recommended Provider Priority

| Priority | Provider | Model | Cost | Best For | RPM (Free) |
|---|---|---|---|---|---|
| 1 | **Groq** | Llama 3.3 70B | Free / $0.59/1M | Fast batch processing, extraction | 30 |
| 2 | **Gemini** | 2.0 Flash | Free / $0.10/1M in | Structured JSON, high volume | 15 (when available) |
| 3 | **Gemini** | 2.5 Pro | Free preview | Complex reasoning, personality | 5 |
| 4 | **Claude** | Haiku 4.5 | $0.80/1M in | Quality narratives, batch API 50% off | Paid only |
| 5 | **Together.ai** | Llama 3.3 70B | $0.60/1M | Overflow when Groq exhausted | Paid only |

### Implementation: `pipeline/lib/llm_router.py`

Build a universal LLM router that all pipeline scripts use:

```python
from lib.llm_router import call_llm

result = call_llm(
    prompt="...",
    model_preference="fast",  # fast|quality|cheap
    json_mode=True,
    max_retries=3,
)
```

The router automatically:
- Tries providers in priority order
- Falls back on 429/quota errors
- Logs cost per call for tracking
- Supports `json_mode=True` for structured output
- Caches results to avoid re-processing on retry

This replaces the per-script Gemini init pattern and makes every script resilient to any single provider going down.

---

## Verification

After implementation:

- [ ] Run `python pipeline/tests/test_data_integrity.py` — all tests should pass
- [ ] Check admin dashboard coverage percentages — should show improvement
- [ ] Run `python pipeline/40_promote_to_prod.py --dry-run` — more players should qualify for Tier 1
- [ ] Spot-check 10 random players for data completeness across all 6 tables
- [ ] Verify `38_infer_personality.py` output correlates with 104 manually-scored players
- [ ] Verify `39_infer_blueprints.py` output matches 49 existing blueprints
- [ ] Test LLM router fallback chain: kill Gemini key → verify Groq picks up
