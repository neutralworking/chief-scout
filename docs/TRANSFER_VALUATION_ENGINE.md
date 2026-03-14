# Transfer Valuation Engine — Technical Specification

> **Version**: 1.0.0 | **Status**: Phase 1 (Rule-Based) Implemented | **Date**: 2026-03-14

## Overview

The Transfer Valuation Engine is a multi-dimensional, scouting-profile-driven transfer valuation system where the **primary driver of value is the player's archetype vector** — not a single overall rating, but a structured 12-dimensional profile evaluated against a specific positional need, tactical system, and squad context.

**Philosophy**: There is no scalar "ability" — only contextual fit. A player's value is the shape of their profile evaluated against what a specific club needs.

---

## Architecture

### Three-Layer Model Stack

```
Layer 1: Profile → Latent Ability
  Input:  12 archetype scores + 48 attribute grades + personality + style tags
  Output: Ability estimate (0-100) with Monte Carlo uncertainty

Layer 2: Ability → Market Value
  Input:  Ability distribution + age + contract + league + personality tags
  Output: Market value distribution (P10/P25/P50/P75/P90)

Layer 3: Market Value → Contextual Fee Band
  Input:  Market value + buying club + tactical system + squad gaps
  Output: Adjusted fee band + use value + contextual fit score
```

### Key Principles

1. **No overall rating**: The 12-dimensional archetype vector is the core input, not a scalar
2. **Confidence-driven uncertainty**: Low-confidence profiles produce 3-5× wider value bands
3. **Scout dominance**: Configurable λ parameter (default 0.7) ensures scouting profile drives valuation
4. **Disagreement surfacing**: When scout and data disagree, both values are reported — no silent overrides
5. **Contextual fit**: Value to a specific club (use value) is distinct from general market value

---

## Directory Structure

```
valuation_core/               # Python — core engine
├── models/
│   ├── ability_model.py      # Layer 1: Profile → ability estimate (Monte Carlo)
│   ├── market_model.py       # Layer 2: Ability → market value (rule-based, Phase 2: GBM)
│   ├── context_model.py      # Layer 3: Market value → fee band + use value
│   └── ensemble.py           # Full pipeline orchestrator
├── features/
│   ├── profile_features.py   # Archetype, attribute, personality, style tag encoding
│   ├── market_features.py    # Age curves, contract, league, macro
│   └── context_features.py   # Buying club, system fit, squad gaps
├── fit/
│   ├── positional_fit.py     # Positional relevance tier scoring
│   ├── system_fit.py         # Tactical system compatibility (6 systems)
│   └── squad_fit.py          # Squad gap analysis
├── calibration/
│   └── benchmarking.py       # Interval calibration + benchmark targets
├── explain/
│   └── narrative_generator.py # Human-readable valuation summaries
├── config.py                 # All reference data, thresholds, style tables
├── types.py                  # Core data types (PlayerProfile, ValuationResponse, etc.)
└── data_loader.py            # Supabase → PlayerProfile bridge

valuation_api/                # FastAPI service
├── main.py                   # App entry point
├── schemas.py                # Pydantic request/response models
├── service.py                # Service layer (DB → engine → response)
└── routes/
    └── value.py              # POST /value, /batch_value, /simulate

client_sdk/                   # TypeScript client
├── types.ts                  # All TypeScript interfaces
├── client.ts                 # API client class
└── index.ts                  # Public exports

tests/
├── test_fit_scoring.py       # Positional, system, squad fit tests
├── test_valuation_pipeline.py # Full pipeline + worked examples
└── test_calibration.py       # Calibration metrics tests

pipeline/sql/
└── 027_transfer_valuation.sql # Database migration
```

---

## Data Model

### Database Tables (Migration 027)

| Table | Purpose |
|-------|---------|
| `player_valuations` | One row per valuation evaluation: market value band, use value, decomposition, confidence, flags, narrative |
| `valuation_comparables` | Comparable transfers linked to a valuation |
| `valuation_config` | Reference data (style tables, positional tiers) stored as JSONB |

### Input Profile Structure

The engine consumes a `PlayerProfile` with:

| Field | Type | Description |
|-------|------|-------------|
| `archetype_scores` | `dict[str, float]` | 13 model scores, 0-100 (Controller through GK) |
| `attributes` | `dict[str, AttributeGrade]` | 48 attributes, each with effective_grade (1-10), grade_type, confidence, stale flag |
| `personality_code` | `str` | 4-letter MBTI-style code (INSP, AXLC, etc.) |
| `personality_tags` | `list[str]` | Risk/value/neutral tags from Categories 1-3 |
| `playing_style_tags` | `list[str]` | 34 tactical behaviour tags from Category 4 |
| `age`, `position`, `contract_years_remaining` | various | Core demographics |
| `league`, `level`, `trajectory` | various | Market context |

---

## Feature Space

### Profile Features (Layer 1)

| Feature Group | Count | Encoding |
|--------------|-------|----------|
| Archetype scores (raw) | 13 | Continuous 0-100 |
| Primary/secondary archetype | 26 | One-hot per model |
| Primary-secondary gap | 1 | Continuous |
| Per-attribute grades | 48 | Continuous 1-10 |
| Attribute ceiling/floor | 2 | Continuous |
| Profile confidence score | 1 | Continuous 0-1 |
| Inferred/stale fractions | 2 | Continuous 0-1 |
| Positional fit score | 1 | Continuous 0-1 |
| Personality poles | 4 | Binary |
| Risk/value tag counts | 2 | Integer |
| High-impact tag flags | 7 | Binary |
| Playing style tags | 34 | Multi-hot |

### Market Features (Layer 2)

| Feature | Encoding |
|---------|----------|
| Age + age² | Continuous + quadratic |
| Age multiplier (position-specific curve) | Continuous |
| Contract years + cliff multiplier | Continuous |
| Position scarcity | Continuous |
| League strength | Continuous |
| National team premium | Continuous |
| Injury days (log) + chronic flag | Continuous + binary |
| Trajectory multiplier | Continuous |
| Wage (log) | Continuous |
| Release clause | Continuous + binary flag |

### Context Features (Layer 3, per-evaluation)

| Feature | Description |
|---------|-------------|
| System archetype fit | Weighted match vs style archetype requirements |
| System threshold fit | % of style-required attribute thresholds met |
| System personality fit | Pole alignment with style-personality matrix |
| System tag compatibility | Asset tags minus concern tags |
| Squad gap fill | How much player addresses identified squad gaps |
| Window multiplier | Summer/winter/out-of-window |
| Selling pressure | 0-1 discount for financially pressured sellers |

---

## Tactical System Compatibility

Six systems are defined with archetype requirements, preferred/concern tags, and personality preferences:

| System | Key Archetype Requirements | Preferred Tags | Personality |
|--------|---------------------------|----------------|-------------|
| **Gegenpress** | Engine≥55, Sprinter≥50, Destroyer≥45 | Press Trigger, Counter-Press Leader, Transition Threat | C+N |
| **Tiki-Taka** | Passer≥60, Controller≥55, Dribbler≥50 | Press Resistant, Tempo Setter, Ball Progressor | A+P |
| **Counter-Attacking** | Cover≥55, Sprinter≥55, Destroyer≥50 | Transition Threat, Phase Skipper, Deep Defender | I+C |
| **Wing Play** | Dribbler≥55, Sprinter≥55, Passer≥50 | Width Provider, Overlap Runner, Box Crasher | X |
| **Catenaccio** | Cover≥60, Destroyer≥55, Commander≥50 | Deep Defender, Cover Shadow, Controlled Aggressor | A+L+P |
| **Total Football** | Engine≥50, Passer≥50, Controller≥50 | Ball Progressor, Inverted Player, Two-Footed | A+N |

---

## Personality Tag Adjustments

### Risk Tags (Multiplicative Discounts)

| Tag | Adjustment |
|-----|-----------|
| Declining Trajectory | -10% |
| High Exit Probability | -8% |
| Unproven at Sustained Level | -6% |
| Contract Sensitive | -6% |
| Commercially Motivated | -5% |
| Disciplinary Vulnerability | -5% |
| Environmental Sensitivity | -4% |
| Individual Agenda | -4% |
| High Maintenance | -4% |

### Value Tags (Multiplicative Premiums)

| Tag | Adjustment |
|-----|-----------|
| Undroppable | +8% |
| Proven at Level | +7% |
| Culture Setter | +6% |
| Big Game Player | +5% |
| Context Neutral | +4% |
| Captain Material | +4% |
| Low Maintenance | +3% |

---

## Confidence → Uncertainty Mapping

| Profile State | Band Width | P10-P90 Range |
|--------------|-----------|---------------|
| All High confidence, scout-graded | ×1.0 | ±15-20% |
| Mixed confidence, stat-derived | ×1.8 | ±25-35% |
| Mostly Low/Inferred | ×3.0 | ±40-60% |
| Single-source, <500 min | ×4.5 | ±50-75% |

Implemented via Monte Carlo (N=100 forward passes) with Gaussian noise scaled to confidence level per attribute.

---

## Scout Dominance Parameter (λ)

| Mode | λ | Behavior |
|------|---|----------|
| `scout_dominant` | 0.7 | Profile drives, data refines (default) |
| `balanced` | 0.5 | Equal weight |
| `data_dominant` | 0.3 | Data drives, profile is soft context |

Formula: `posterior = λ × scout_value + (1-λ) × data_value`

---

## API Contracts

### POST /api/v1/value

**Request:**
```json
{
  "player_id": 1001,
  "evaluation_context": {
    "buying_club": {
      "club_name": "Manchester City",
      "league": "Premier League",
      "financial_tier": "elite",
      "objective": "title"
    },
    "target_position": "AM",
    "target_system": "tiki_taka",
    "squad_gaps": [],
    "window": "summer"
  },
  "mode": "scout_dominant"
}
```

**Response:**
```json
{
  "market_value": {
    "central": 29174218,
    "p10": 12603178,
    "p25": 20888698,
    "p75": 37459737,
    "p90": 45745257,
    "currency": "EUR"
  },
  "use_value": {
    "central": 35745432,
    "contextual_fit_score": 0.782,
    "contextual_fit_breakdown": {
      "system_archetype_fit": 1.0,
      "system_threshold_fit": 1.0,
      "system_personality_fit": 0.462,
      "system_tag_compatibility": 0.833,
      "squad_gap_fill": 0.5
    }
  },
  "decomposition": {
    "scout_profile_contribution": 70.0,
    "performance_data_contribution": 0.0,
    "contract_age_contribution": 0.0,
    "market_context_contribution": 20.4,
    "personality_adjustment": 10.0,
    "playing_style_fit_adjustment": 22.5
  },
  "confidence": {
    "profile_confidence": 0.570,
    "data_coverage": 0.627,
    "overall_confidence": "medium",
    "band_width_ratio": 3.63
  },
  "flags": {
    "disagreement_flag": false,
    "stale_profile": false,
    "low_data_warning": false,
    "personality_risk_flags": [],
    "playing_style_risk_flags": []
  },
  "narrative": "Valued at €29.2m (band: €12.6m–€45.7m). ...",
  "model_version": "v1.0"
}
```

### POST /api/v1/batch_value

Accepts `{ "requests": [...] }` with up to 50 ValuationRequests. Returns array of ValuationResponses.

### POST /api/v1/simulate

Like `/value` but accepts a `changes` dict to override profile fields before re-valuation.

---

## Worked Examples

### Example A — Marco Stellari (Established Starter)

**Profile:**
- 27-year-old AM in La Liga (Atletico Madrid)
- Primary: Creator (80) / Secondary: Dribbler (75)
- High-confidence scout grades: Creativity 8, Vision 8, Take-ons 7.5, First Touch 7.5
- Personality: INSP (The Maestro) — no risk tags, "Proven at Level" + "Low Maintenance"
- Style: Line Breaker, Press Resistant, Half-Space Operator, Ball Progressor, Link-Up Artist
- 4 years on contract, regular international

**Layer 1 — Ability Estimation:**
The archetype vector enters with Creator (80) and Dribbler (75) as the dominant dimensions. At AM position, Creator has weight 1.0 and Dribbler 0.8 — positional fit is excellent. With mostly High-confidence scout grades, Monte Carlo noise is small (σ=5%), producing tight ability estimate: **central=69.4, std=4.2**.

**Layer 2 — Market Value:**
- Base value from ability 69.4: ~€14m
- Age multiplier at 27 for AM: 0.95 (just past peak start)
- Contract multiplier at 4yr: 1.0
- La Liga league strength: 1.05
- National team (regular): 1.06
- Personality premium: +10% (Proven at Level +7%, Low Maintenance +3%)
- Position scarcity (AM): 1.10
- Scout-anchored value: **€19.4m**
- Data-implied value (from level 85): **€52.0m**
- λ=0.7 blend: **€29.2m** (P10: €12.6m, P90: €45.7m)

**Layer 3 — Contextual Valuation (Tiki-Taka, Man City):**
- System archetype fit: 1.0 (Creator 80 exceeds tiki-taka threshold of 45; Passer 70 exceeds 60; Dribbler 75 exceeds 50)
- System tag compatibility: 0.83 (Press Resistant, Ball Progressor, Link-Up Artist all align)
- Personality fit: 0.46 (INSP: Instinctive not Analytical, but Composer matches P preference)
- Contextual fit score: **0.782** (strong fit)
- Use value: **€35.7m** (market value × 1.23 fit multiplier)

**Narrative:**
> "Valued at €29.2m (band: €12.6m–€45.7m). The valuation is driven primarily by a Creator-Dribbler profile (80/75) with Creativity 8 and Unpredictability 8. At 27 with 4 years remaining, the age-contract profile supports a near-peak valuation. Personality value tags (Proven at Level, Low Maintenance) apply a +10% premium. Contextual fit for a Tiki Taka system is 0.78 — strong fit. Ball Progressor, Link-Up Artist, Press Resistant tags align."

---

### Example B — Tiago Mendes (Breakout Prospect)

**Profile:**
- 19-year-old WF in Eredivisie (FC Twente)
- Primary: Sprinter (72) / Secondary: Dribbler (62)
- Medium confidence on 2 attributes (Pace 8.5, Acceleration 8), Low/Inferred on rest
- Personality: IXSC (The Maverick) — no personality tags
- Style: Direct Runner, Transition Threat [both inferred]
- 2 years on contract, no international caps

**Layer 1 — Ability Estimation:**
With mostly Low/Inferred confidence, Monte Carlo noise is large (σ=30% per attribute). At WF, Dribbler (1.0 weight) and Sprinter (0.9) are primary archetypes — the scores (72/62) provide moderate positional fit. But 10/14 attributes are Low confidence, creating wide distribution: **central=52.1, std=12.8**.

**Layer 2 — Market Value:**
- Base value from ability 52.1: ~€1.7m
- Age multiplier at 19 for WF: 1.14 (strong youth premium)
- Contract multiplier at 2yr: 0.80 (short contract = discount)
- Eredivisie league strength: 0.80
- No national team premium
- No personality adjustment (no tags)
- Diffuse prior → band width multiplier ×3.0
- Scout-anchored value: **€2.1m**
- Data-implied value (from level 70): **€1.3m**
- λ=0.5 (balanced mode) blend: **€1.7m** (P10: €0, P90: €11.9m)

The extremely wide P90 (€11.9m vs €1.7m central) reflects the high uncertainty — this player could break out into a €10m+ talent or plateau at €1-2m.

**Layer 3 — Contextual Valuation (Gegenpress, Brighton):**
- System archetype fit: 0.80 (Sprinter 72 exceeds gegenpress threshold of 50, but Engine 48 falls short of 55)
- System threshold fit: 0.0 (no key attributes — pressing, stamina, intensity — have grades ≥6)
- Personality fit: 0.54 (IXSC: Competitor matches C preference, Instinctive matches I, but Extrinsic and Soloist are neutral)
- Tag compatibility: 0.64 (Transition Threat matches, Direct Runner not in preferred list)
- Contextual fit score: **0.547** (partial fit with concerns)
- Use value: **€1.7m** (market value × 1.04 — marginal fit premium)
- **Low data warning: YES**

**Narrative:**
> "Valued at €1.7m (band: €0–€11.9m). The valuation is driven primarily by a Sprinter-Dribbler profile (72/62) with Pace 8 and Acceleration 8. At 19 with 2 years remaining, the age-contract profile supports a high-potential valuation with significant upside. Contextual fit for a Gegenpress system is 0.55 — partial fit with concerns. Transition Threat, Direct Runner tags align."

---

## Implementation Plan

### Phase 1 — Foundation (Current: Implemented)
- Feature store, profile ingestion, contextual fit scoring
- Rule-based valuation from archetype fit + historical benchmarks
- Full API and TypeScript client
- 38 passing tests covering fit scoring, valuation pipeline, calibration

### Phase 2 — Ability Model (Next)
- Train CatBoost + LightGBM ensemble on historical performance data
- Position-stratified models (GK, Defender, Midfielder, Forward)
- SHAP explanations with archetype feature importance ≥25%
- Data: FBref per-90 metrics matched with profile snapshots

### Phase 3 — Market Value Model
- Monotonic GBM with age curve constraints
- Quantile regression for P10/P25/P50/P75/P90
- Training target: actual completed transfer fees (log-transformed)
- Position-specific age curves learned from data

### Phase 4 — Interval Calibration
- Conformal prediction for guaranteed coverage
- Isotonic calibration on validation set
- Benchmark: R² ≥ 0.75, MAPE < 35%, 80% P10-P90 coverage

### Phase 5 — Integration
- Connect to Chief Scout Supabase instance
- Write valuations back to `player_valuations` table
- Next.js UI for valuation display on player profiles
- Comparable transfers via nearest-neighbour in archetype space

---

## Calibration Targets

| Metric | Target |
|--------|--------|
| R² on log-transformed fees | ≥ 0.75 |
| Mean absolute percentage error | < 35% |
| P10-P90 interval coverage | ~80% |
| SHAP importance of archetype features (scout mode) | ≥ 25% |

---

## Integration with Chief Scout

- **Reads from**: `people`, `player_profiles`, `player_personality`, `player_market`, `player_status`, `attribute_grades`, `career_metrics`, `clubs`, `nations`, `tags`, `player_tags`
- **Writes to**: `player_valuations`, `valuation_comparables`, `valuation_config`
- **Reference data**: Style compatibility tables and positional tiers are config, not learned
- **Supabase project**: `fnvlemkbhohyouhjebwf` (EU Frankfurt)
