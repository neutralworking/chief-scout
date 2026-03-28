# Unified Similarity Engine — Design Spec

> **Date:** 2026-03-28
> **Status:** Approved
> **Goal:** Replace three separate comparison algorithms with a single unified scoring engine that supports two lenses: Closest Match and Potential Replacement.

---

## Problem

Chief Scout has three independent similarity algorithms:

1. **Legend→Active** (`similar/route.ts` lines 16-64) — skillset-first, 40pts primary archetype, ignores pillars/traits/grades
2. **Active→Active** (`similar/route.ts` lines 70-108) — 8-factor balanced, uses tech+physical but ignores tactical+mental
3. **Transfer Comparables** (`transfer-comparables.ts`) — 7-dimension normalized, purpose-built for valuation

Problems:
- Pillar imbalance: tactical and mental scores ignored in active→active
- 16 playing style traits exist but no algorithm uses them
- Earned archetype (most descriptive label) underweighted at 10pts
- Legend path ignores grades entirely — a legend Striker with elite finishing doesn't preferentially match an active Striker with elite finishing
- No height/body type consideration
- Separate codepaths for legend vs active, doubling maintenance cost
- No transparency — users see a similarity % with no explanation of why

## Solution

One scoring function with **10 factors**, each returning 0.0–1.0. Two **lenses** apply different weight distributions:

- **Closest Match** — "who plays like this?" — emphasises style, profile shape, traits
- **Potential Replacement** — "who could do this job?" — emphasises role fit, output level, physical profile

Transfer Comparables stays separate (scores transfers, not players).

---

## Scoring Factors

### Factor 1: Role Match
- **Source:** `best_role` from `player_intelligence_card`
- **Scoring:**
  - Exact role match = 1.0
  - Same position, different role = 0.5
  - Adjacent position role = 0.25
  - No match = 0.0
- **Adjacent positions:** GK→[GK], WD→[WD,WM], CD→[CD,DM], DM→[DM,CM,CD], CM→[CM,DM,AM], WM→[WM,WD,WF], AM→[AM,CM,WF,CF], WF→[WF,WM,AM,CF], CF→[CF,AM,WF]

### Factor 2: Role Score Proximity
- **Source:** `best_role_score` from `player_intelligence_card`
- **Scoring:** `Math.max(0, 1.0 - Math.abs(diff) / 30)`
- **Null handling:** If either player lacks a role score, return 0.5 (neutral)

### Factor 3: Archetype Alignment
- **Source:** `earned_archetype` and `archetype` from `player_intelligence_card`
- **Deriving models:** The `archetype` column stores a compound string (e.g., `"Engine-Destroyer"`). Split on `"-"` to extract primary and secondary models. If no `"-"`, the entire string is the primary model with no secondary.
- **Scoring (best match wins):**
  - Exact earned archetype match = 1.0
  - Exact primary model match = 0.7
  - Source primary = target secondary (or vice versa) = 0.4
  - Secondary model match = 0.3
  - No overlap = 0.0
- **Null handling:** If either player lacks archetype data, return 0.0

### Factor 4: Pillar Shape
- **Source:** `technical_score`, `tactical_score`, `mental_score`, `physical_score` from `player_intelligence_card`
- **Scoring:** Proportion-normalized cosine similarity of the 4D vector [tech, tac, men, phy].
  - **Step 1:** Normalize each player's vector to sum to 1 (proportions). E.g., [80, 60, 70, 50] → [0.31, 0.23, 0.27, 0.19]. This captures *relative* strengths rather than absolute magnitude.
  - **Step 2:** Cosine similarity of the two proportion vectors.
  ```
  // Normalize to proportions
  sumA = sum(a[i]);  a_norm[i] = a[i] / sumA
  sumB = sum(b[i]);  b_norm[i] = b[i] / sumB
  // Cosine of proportion vectors
  dot = sum(a_norm[i] * b_norm[i])
  magA = sqrt(sum(a_norm[i]^2))
  magB = sqrt(sum(b_norm[i]^2))
  similarity = dot / (magA * magB)
  ```
  This avoids the problem where raw cosine returns ~0.99 for all positive, similar-magnitude vectors. Proportion-normalization ensures a [80,60,70,50] player and a [40,30,35,25] player score 1.0 (same shape) while a [80,40,40,80] player scores lower (different shape).
- **Null handling:** If any pillar is null for either player, use available pillars only (reduce dimensionality). If <2 pillars available, return 0.5.

### Factor 5: Trait Overlap
- **Source:** `player_trait_scores` table (trait names per player)
- **Scoring:** Jaccard index = |intersection| / |union|
  - Both have ["Ball Progressor", "Clinical Finisher", "Press Resistant"] and ["Ball Progressor", "Set Piece Threat", "Press Resistant"] → 2/4 = 0.5
- **Null handling:** If either player has 0 traits, return 0.0

### Factor 6: Physical Profile
- **Source:** `height_cm`, `preferred_foot`, `side` from `player_intelligence_card` / `people`
- **Scoring (3 sub-components, averaged):**
  - Height band: |diff| ≤ 3cm = 1.0, ≤ 6cm = 0.7, ≤ 10cm = 0.4, else 0.0
  - Foot match: exact = 1.0, else 0.0
  - Side match: exact = 1.0, both central or both null = 0.5, else 0.0
- **Null handling:** Score only populated sub-components. If none populated, return 0.5.

### Factor 7: Personality Match
- **Source:** `personality_type` (4-letter code, e.g., "ESTJ") from `player_intelligence_card`
- **Scoring:** Graduated by matching letters:
  - 4/4 match = 1.0
  - 3/4 match = 0.7
  - 2/4 match = 0.3
  - 1/4 match = 0.1
  - 0/4 match = 0.0
- **Null handling:** If either is null, return 0.0

### Factor 8: Grade Profile
- **Source:** `attribute_grades` table (all grades per player)
- **Scoring:** Cosine similarity of grade vectors, aligned by attribute name
  - Compare all attributes both players have grades for (not limited to top N)
  - If <4 shared attributes, return 0.5 (insufficient overlap)
- **Grade selection:** Use `COALESCE(scout_grade, stat_score)` with highest source priority. One grade per attribute per player (deduplicate by taking max priority source).
- **Null handling:** If either player has <4 total grades, return 0.5

### Factor 9: Quality Band
- **Source:** `level` (active) or `peak` (legends) from `player_intelligence_card`
- **Selection logic:** Use `peak` if `active === false`, else `level`. For cross-era comparisons (active vs legend), each player uses their own metric.
- **Scoring:** `Math.max(0, 1.0 - Math.abs(diff) / 15)`
- **Null handling:** If either is null, return 0.5

### Factor 10: Club Diversity
- **Source:** `club_id` from `player_intelligence_card`
- **Scoring:** Different club = 1.0, same club = 0.0
- **Null handling:** If either is null, return 1.0

---

## Weight Distributions

| Factor | Closest Match | Potential Replacement |
|--------|:---:|:---:|
| 1. Role match | 10 | **25** |
| 2. Role score proximity | 5 | **15** |
| 3. Archetype alignment | **20** | 10 |
| 4. Pillar shape | **15** | 10 |
| 5. Trait overlap | **15** | 5 |
| 6. Physical profile | 10 | **15** |
| 7. Personality match | 10 | 0 |
| 8. Grade profile | **10** | 10 |
| 9. Quality band | 0 | 5 |
| 10. Club diversity | 5 | 5 |
| **Total** | 100 | 100 |

Final similarity score = sum of (factor_score * weight) → 0–100 scale.

---

## Confidence Score

Each factor gets a binary "populated" flag per player-pair. Confidence = populated count / 10.

| Populated | Label | UI Treatment |
|---|---|---|
| 8–10 | Strong match | No badge |
| 5–7 | Partial match | Amber "Partial" badge |
| <5 | Indicative | Grey "Limited data" badge |

---

## Legend Backfill (Pipeline)

New pipeline script `pipeline/91_legend_backfill.py` to populate missing legend data:

1. **Pillar estimation** — derive from existing `attribute_grades` using the same four-pillar formula (from `lib/assessment/four-pillars.ts` logic, ported to Python). Writes to `player_profiles.technical_score`, etc.
2. **Trait inference** — map archetype + top grade attributes to likely traits. E.g., Striker archetype + finishing ≥ 85 + composure ≥ 80 → "Clinical Finisher". Writes to `player_trait_scores`.
3. **Side inference** — extend pipeline 38c to cover legends (EAFC positions + foot fallback).

Target: ~195 legends with curated skillsets should reach 7-8/10 factor coverage (Strong or Partial match confidence).

---

## Candidate Pool

### Pre-filter (DB query)
```sql
SELECT * FROM player_intelligence_card
WHERE position IN (:adjacent_positions)
  AND active = true  -- or include legends if requested
  AND best_role_score IS NOT NULL
  AND id != :source_id
ORDER BY best_role_score DESC
LIMIT 800
```

### Post-filter (in-app)
- Level/peak within ±15 of source (generous — quality band scoring handles precision)

### "Realistic" filter (Replacement lens, optional, Pro-tier)
When `?realistic=true`:
- Level/peak: source - 8 to source + 3 (rising stars welcome, not downgrades beyond 8)
- Age: ≤ source age + 2
- Contract status: LEFT JOIN `player_status` to check `contract_tag`. Exclude `'locked'` if populated. This join is only performed when `realistic=true` to avoid unnecessary overhead on default queries.

---

## API

### Endpoint
```
GET /api/players/[id]/similar?lens=match|replacement&realistic=false&include_legends=false&limit=8
```

### Parameters
| Param | Type | Default | Description |
|---|---|---|---|
| `lens` | string | `match` | `match` = Closest Match, `replacement` = Potential Replacement |
| `realistic` | boolean | `false` | Apply market-aware filters (Pro-tier only) |
| `include_legends` | boolean | `false` | Include retired legends in candidate pool |
| `limit` | number | `8` | Max results |

### Response
```json
{
  "lens": "match",
  "source": {
    "id": 123,
    "name": "Bukayo Saka",
    "position": "WF",
    "best_role": "Inside Forward",
    "earned_archetype": "Marksman"
  },
  "results": [
    {
      "player": {
        "id": 456,
        "name": "Mohammed Kudus",
        "position": "WF",
        "club": "West Ham",
        "best_role": "Inside Forward",
        "earned_archetype": "Marksman",
        "best_role_score": 86,
        "level": 85
      },
      "similarity": 82,
      "confidence": "strong",
      "populated_factors": 9,
      "factors": {
        "role_match": 1.0,
        "role_score_proximity": 0.87,
        "archetype_alignment": 1.0,
        "pillar_shape": 0.91,
        "trait_overlap": 0.67,
        "physical_profile": 0.57,
        "personality_match": 0.5,
        "grade_profile": 0.78,
        "quality_band": 0.93,
        "club_diversity": 1.0
      },
      "match_reasons": [
        "Same role (Inside Forward)",
        "Same archetype (Marksman)",
        "Similar pillar profile",
        "3 shared traits"
      ]
    }
  ]
}
```

### Match Reasons Generation
Top 3 reasons selected by highest factor score:
- Role match 1.0 → "Same role ({role})"
- Archetype 1.0 → "Same archetype ({archetype})"
- Pillar shape ≥ 0.85 → "Similar pillar profile"
- Trait overlap ≥ 0.5 → "{n} shared traits"
- Grade profile ≥ 0.8 → "Similar grade profile"
- Physical 1.0 → "Same build and side"
- Personality 1.0 → "Same personality type"
- Quality band ≥ 0.9 → "Similar quality level"

---

## File Structure

```
apps/web/src/lib/similarity/
  engine.ts          — unified scoring function (10 factors + 2 weight sets)
  factors.ts         — individual factor scoring functions
  types.ts           — SimilarityResult, SimilarityFactor, Lens types
  match-reasons.ts   — human-readable reason generation

apps/web/src/app/api/players/[id]/similar/
  route.ts           — replaces current route, uses new engine

pipeline/
  91_legend_backfill.py  — pillar estimation + trait inference for legends
```

The old `similar/route.ts` (234 lines with three separate scoring functions) is replaced by the unified engine. The `transfer-comparables.ts` is **not** changed — it serves a different purpose (valuing transfers, not comparing players).

---

## UI Changes

### Player Detail Page
- "Similar Players" section shows **Closest Match** by default
- Tab toggle: "Closest Match" | "Replacements"
- Each result card: similarity %, confidence badge (if not Strong), top 2-3 match reason pills
- "Replacements" tab has a "Realistic" toggle (Pro-tier gated via `PaywallGate`)
- **"Plays Like" legend comparison preserved:** When `include_legends=true`, the response includes legend matches. Player detail page shows a "Plays Like {Legend}" badge when a strong legend match exists (similarity ≥ 60). This replaces the old `legendComps` response field.

### Consumer Updates (Breaking Change)
The response shape changes from `{ players: [...], legendComps: [...] }` to `{ lens, source, results }`. These consumers must be updated:

1. **`SimilarPlayers.tsx`** — currently reads `data.players` and `data.legendComps`. Update to read `data.results`. For legend matches, make a second call with `include_legends=true` or combine into one call.
2. **Legends page `SimilarActivePlayer`** (lazy-loaded per row) — currently reads `data.players[0]`. Update to read `data.results[0]`.

### Legends Page
- "Plays Like" column continues using Closest Match lens with `include_legends=false`
- No change to lazy-loading or display logic, only the response field name changes

### Compare Page
- No change — this is a head-to-head data comparison, not a similarity search

---

## Migration Path

1. Build `lib/similarity/` module (engine + factors + types + match-reasons)
2. Run legend backfill pipeline (pillar estimation + trait inference)
3. Replace `similar/route.ts` with new unified endpoint
4. Update `SimilarPlayers.tsx` to consume new response shape
5. Update legends page `SimilarActivePlayer` to consume new response shape
6. Update player detail UI (tabs + reason pills + "Plays Like" legend badge)
7. Verify legends "Plays Like" column still works
8. Remove old scoring functions

No database migration required — all data sources already exist. Legend backfill writes to existing tables (`player_profiles`, `player_trait_scores`). The `contract_tag` filter uses a LEFT JOIN to `player_status` only when `realistic=true`.
