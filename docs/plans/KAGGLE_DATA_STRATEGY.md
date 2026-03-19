# Kaggle Data Strategy — How We Use It

*Director of Football Assessment — 2026-03-16*

## Overview

Five new Kaggle datasets have been ingested into the pipeline. This document outlines how each dataset feeds into the product — not just as raw data, but as **scouting intelligence** that powers player evaluation, market positioning, and product features.

---

## Dataset 1: European Top Leagues Player Stats 25-26
**Source**: kaanyorgun — `kaggle_euro_league_stats`
**What it gives us**: Current-season stats across top 5 leagues (goals, assists, xG, xA, progressive actions, cards)

### Use Cases

**A. Coverage Gap Filler for FBRef**
- Our FBRef ingest requires manual HTML saves. This dataset gives us bulk 25-26 season stats for players we haven't scraped yet.
- **Action**: Cross-reference with `fbref_player_season_stats` — any player in Kaggle but not in FBRef gets their stats backfilled.
- **Pipeline**: New script `51_kaggle_to_fbref_backfill.py` — maps Kaggle stats to `fbref_player_season_stats` columns for unmatched players.

**B. Attribute Grade Generation**
- Feed into `22_fbref_grades.py` methodology: convert per-90 stats into positional percentile grades (1-20).
- Progressive carries → Dribbler model score
- Progressive passes → Passer model score
- xG/goals → Striker model score
- **Deliverable**: 500-1000+ new `attribute_grades` rows (source='kaggle_euro')

**C. Season Trend Comparison**
- Compare 25-26 stats with existing 24-25 FBRef data to identify **breakout players** (big stat jumps) and **declining players** (stat drops).
- **Product feature**: "Rising Stars" and "Declining Stock" lists on the dashboard.
- **SQL**: `SELECT k.player_name, k.xg_per90 - f.xg_per90 AS xg_delta FROM kaggle_euro_league_stats k JOIN fbref_player_season_stats f ON k.person_id = f.player_id WHERE k.season = '2025-2026' AND f.season = '2024-2025'`

**D. Free Agent Intelligence**
- Players with high stats but expiring contracts (cross-reference with `player_status.contract_tag`) = **high-value free agent targets**.
- Enriches the `/free-agents` page with current-season performance context.

---

## Dataset 2: Transfer Value Intelligence
**Source**: kanchana1990 — `kaggle_transfer_values`
**What it gives us**: Market values, transfer fees, contract details, agent info

### Use Cases

**A. Market Value Calibration**
- Cross-validate against our existing Transfermarkt data (`transfermarkt_valuations`) and internal `player_market` table.
- Where values diverge significantly, flag for manual review — either our data is stale or there's a genuine market inefficiency.
- **Action**: Run `--enrich` flag to update `player_market.market_value_eur` for matched players.

**B. Transfer Fee Benchmarking**
- Historical transfer fees enable **value-for-money analysis**: did a club overpay or get a bargain?
- Feed into `41_valuation_engine.py` as training data for the market premium calculation.
- **Metric**: `transfer_fee_eur / market_value_eur` ratio — anything > 1.3 = overpay, < 0.7 = bargain.

**C. Contract Intelligence**
- Contract expiry dates feed directly into `player_status.contract_tag`.
- Agent names are new data — could power a future "Agent Network" feature (which agents represent which archetypes of player).
- **Product feature**: Contract countdown on player cards ("6 months remaining").

**D. Scarcity Score Refinement**
- Combine market value + position + age + contract length to compute a more accurate `player_market.scarcity_score`.
- Formula: `scarcity = f(position_demand, age_curve_remaining, contract_length, comparable_players_count)`
- Rare profiles (e.g., left-footed ball-playing CB under 23) get premium scarcity scores.

**E. Outfitter Data (Nice-to-Have)**
- Kit supplier info is a minor commercial data point — could indicate player marketability.
- Low priority but unique data that no other scouting tool surfaces.

---

## Dataset 3: FIFA Historical 1930-2022
**Source**: zkskhurram — `kaggle_fifa_matches` + `kaggle_fifa_rankings`
**What it gives us**: International match results + FIFA rankings

### Use Cases

**A. Nation Strength Index**
- FIFA rankings feed into a **nation strength modifier** for player evaluation.
- A player performing well for a top-10 ranked nation carries more weight than one starring for a team ranked 80th.
- **Action**: Create `nation_strength` column on `nations` table from latest FIFA rankings.
- **Product feature**: Nation badge on player cards shows ranking tier (Elite / Strong / Emerging / Developing).

**B. Football Choices Content**
- Historical match results are **goldmine content for the Gaffer game**.
- New question categories: "1966 World Cup Final: Who would you start?", "Greatest upset? Greece 2004 or Leicester 2016?"
- **Action**: Script to generate Gaffer questions from iconic matches (finals, upsets, high-scoring games).
- **Deliverable**: 50+ new questions for `/choices` from historical match data.

**C. International Career Context**
- Cross-reference with `player_career_history` to show international match context.
- "Virgil van Dijk has played in X international matches for a top-5 ranked nation" — adds weight to scouting assessment.
- **Product feature**: International record summary on player detail page.

**D. Tournament Form Analysis**
- Historical xG data (where available) shows which nations over/underperform expectations.
- Useful for World Cup 2026 preview content — drives traffic and engagement.

---

## Dataset 4: Premier League 2024-2025
**Source**: furkanark — `kaggle_pl_stats`
**What it gives us**: Granular PL player stats and/or match data

### Use Cases

**A. PL-Specific Deep Dive**
- The Premier League is our primary market. Detailed PL stats enable **deeper analysis than top-5 aggregate data**.
- Defensive metrics (tackles, interceptions, blocks), pressing stats, aerial data — these map directly to SACROSANCT attributes.
- **Grade mapping**:
  - Tackles + Interceptions → Destroyer model
  - Aerial won → Target model
  - SCA/GCA → Creator model
  - Pass completion → Passer model

**B. Attribute Grade Enrichment**
- Use `--grades` flag to compute `attribute_grades` (source='kaggle_pl') for matched players.
- This gives us a **third statistical source** (alongside FBRef and Understat) for PL players — enabling cross-source validation.
- Where all 3 sources agree on a grade, confidence = high. Where they diverge, flag for scout review.

**C. Match-Level Data (if present)**
- If the dataset includes match results, feed into a PL-specific match database.
- Enables **form analysis**: "Arsenal have won 8 of last 10" contextualized with xG trends.
- **Product feature**: Club form widget on `/clubs/[id]` pages.

**D. Squad Depth Analysis**
- Minutes played across PL squads reveals **rotation patterns** and **nailed-on starters** vs **fringe players**.
- Fringe players at big clubs = potential loan/transfer targets for smaller clubs.
- **Product feature**: "Available Players" filter — PL players with <900 minutes who might be gettable.

---

## Dataset 5: European Football Injuries 2020-2025 ⭐ HIGHEST IMPACT
**Source**: sananmuzaffarov — `kaggle_injuries`
**What it gives us**: Injury records with type, severity, days/games missed

### Use Cases

**A. Physical Pillar Revolution**
- The Four-Pillar Assessment's **Physical pillar** (25% of overall score) currently relies on age curve + FBRef minutes. Injuries data transforms this into a **real durability assessment**.
- **New formula**: Physical = 30% availability (minutes) + 30% durability (injury history) + 25% age curve + 15% trajectory
- A player with elite stats but 8 injuries in 3 seasons gets a significantly lower Physical score.

**B. Fitness Tags (Automated)**
- The `--tags` flag on `49_kaggle_injuries.py` auto-sets `player_status.fitness`:
  - 8+ injuries or 300+ days missed → "Injury Prone"
  - 5-7 injuries or 150-299 days → "Moderate Risk"
  - ≤2 injuries and <30 days → "Iron Man"
- **Product feature**: Fitness badge on player cards (green/amber/red traffic light).

**C. Durability Trait Scores**
- The `--traits` flag computes `player_trait_scores`:
  - `durability` (1-10): injuries per season
  - `availability` (1-10): days missed per season
- These feed into the **Tactical pillar's trait profile** component (30% of tactical score).

**D. Injury Pattern Analysis**
- Track injury recurrence by body area: a player with 3 hamstring injuries is a different risk than one with 3 contact injuries.
- **Metric**: `recurring_injury_risk = count of same injury_area / total injuries`
- Recurring muscle injuries (hamstring, calf, groin) = structural risk. Contact injuries = bad luck.
- **Product feature**: Injury timeline on player detail page showing pattern.

**E. Transfer Risk Assessment**
- For any player on a shortlist, injury history is a **deal-breaker or discount lever**.
- "This player's talent is worth €40M, but his injury record means we should bid €28M and structure with appearance bonuses."
- **Product feature**: Risk flags on shortlist view — "⚠️ 6 injuries in 3 seasons, 142 days missed"

**F. Scouting Tags Enhancement**
- Script `29_scouting_tags.py` can now incorporate injury data:
  - `injury_prone` tag for high-risk players
  - `iron_man` tag for durable players
  - `glass_cannon` — elite stats but fragile body
  - `workhorse` — moderate stats but always available
- These tags appear on player cards and in shortlist filters.

---

## Cross-Dataset Synergies

### 1. The Complete Player Score
Combining all 5 datasets enables the most comprehensive player evaluation:
- **Technical** ← Euro leagues stats + PL stats + existing FBRef/StatsBomb
- **Tactical** ← Role fit + trait scores (including durability traits from injuries)
- **Mental** ← Personality system + news sentiment (existing)
- **Physical** ← Injuries data + age curve + availability stats
- **Commercial** ← Transfer values + contract data + market positioning

### 2. "Glass Cannon" Detection
Cross-reference: high `kaggle_euro_league_stats.xg_per90` + high `kaggle_injuries` count = **talented but fragile**.
These players are high-risk/high-reward transfer targets — perfect for loan deals or appearance-based contracts.

### 3. Free Agent Value Score
Combine: `kaggle_transfer_values.market_value_eur` + `player_status.contract_tag = 'Expiring'` + `kaggle_euro_league_stats` performance = **best available free agents ranked by value**.
This powers the `/free-agents` page with real intelligence, not just a list.

### 4. Bargain Hunter Algorithm
- Players with HIGH stats (kaggle_euro + kaggle_pl) but LOW market value (kaggle_transfer_values) = **undervalued**.
- Players with LOW injury count (kaggle_injuries) + LOW market value = **hidden gems**.
- **Product feature**: "Bargain Board" — the 20 most undervalued players in European football.

### 5. Nation Tier × Player Quality
- FIFA rankings (kaggle_fifa) inform how impressive a player's international career is.
- A forward scoring 0.5 goals/90 for Brazil (rank 3) is more impressive than for Andorra (rank 150).
- Feeds into the **Mental pillar** — performing at the highest international level demonstrates big-game temperament.

---

## Implementation Roadmap

### Sprint 1: Data Foundation (This Week)
| Task | Script | Impact |
|---|---|---|
| Download all 5 datasets | `make kaggle-download` | Prerequisite |
| Run migration | `033_kaggle_tables.sql` | Create tables |
| Ingest all datasets | `make kaggle-all` | Populate raw data |
| Verify player matching rates | Check `person_id` fill rates | Quality gate |

### Sprint 2: Grade & Score Integration (Next Week)
| Task | Script | Impact |
|---|---|---|
| Generate attribute grades from euro leagues | New: `51_kaggle_grades.py` | 500+ new grades |
| Generate attribute grades from PL stats | `48_kaggle_pl_stats.py --grades` | PL-specific grades |
| Update Physical pillar with injury data | Modify `27_player_ratings.py` | Better overall scores |
| Auto-tag fitness from injuries | `49_kaggle_injuries.py --tags --traits` | Fitness badges |
| Calibrate scarcity scores from transfer values | Modify `41_valuation_engine.py` | Better valuations |

### Sprint 3: Product Features (Week After)
| Feature | Page | Data Source |
|---|---|---|
| Fitness traffic light badge | Player cards | `kaggle_injuries` → fitness tags |
| Injury timeline | `/players/[id]` | `kaggle_injuries` |
| Contract countdown | Player cards | `kaggle_transfer_values` |
| Nation strength badge | Player cards | `kaggle_fifa_rankings` |
| Rising Stars / Declining Stock lists | Dashboard | Euro leagues vs FBRef delta |
| Bargain Board | New page or dashboard widget | Cross-dataset composite |

### Sprint 4: Intelligence Features (Following Week)
| Feature | Description |
|---|---|
| Free Agent Grader | Rank free agents by: stats + value + injuries + age curve |
| Risk Flags on Shortlists | Injury history warnings on shortlisted players |
| Cross-source grade confidence | Where FBRef + Kaggle + Understat agree = high confidence |
| Gaffer historical questions | Generate 50+ questions from FIFA match data |

---

## Success Metrics

| Metric | Current | Target (30 days) |
|---|---|---|
| Players with attribute grades | ~941 | 2,000+ |
| Players with injury data | 0 | 500+ matched |
| Players with market value data | ~200 (Transfermarkt) | 800+ |
| Physical pillar accuracy | Age-only proxy | Injury-informed |
| Free agent page intelligence | Basic list | Scored + ranked + risk-flagged |
| Gaffer questions | 117 | 170+ (with historical) |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Low player matching rate | Medium | High | Improve matching: add DOB, club context, fuzzy matching |
| Kaggle data quality issues | Medium | Medium | Validate with existing FBRef/Transfermarkt data |
| Stale data (datasets not updated) | High | Low | Treat as baseline, overlay with live FBRef/news |
| Column mapping failures | Low | Medium | Flexible column mapping + `raw_json` fallback |
| Duplicate data with existing sources | Medium | Low | Deduplicate by source priority: scout > FBRef > Kaggle |

---

## Source Priority (When Data Conflicts)

1. **Scout assessment** — human evaluation, highest trust
2. **StatsBomb** — event-level, highest granularity
3. **FBRef** — comprehensive season stats, well-established
4. **Understat** — xG specialist, good for attacking metrics
5. **Kaggle datasets** — bulk coverage, good for gap-filling
6. **Wikidata** — biographical data, identity enrichment

Kaggle data should **never override** higher-priority sources. It fills gaps and provides cross-validation.
