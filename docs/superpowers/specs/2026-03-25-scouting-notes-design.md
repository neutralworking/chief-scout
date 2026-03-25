# Scouting Notes v2 — Multi-Perspective Intelligence

**Date**: 2026-03-25
**Status**: Approved
**Scope**: New pipeline script + migration + admin flag UI

---

## Overview

Replace pipeline 72's single-perspective LLM bios with a richer, multi-perspective scouting note system. Each note weaves three lenses into a single 3-5 sentence paragraph:

1. **Scout** — data-grounded strengths/weaknesses, archetype fit, pillar balance
2. **Historian** — tactical lineage of the player's role, what systems suit them
3. **Director of Football** — market position, squad-building utility, risk factors

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Output format | Single upgraded paragraph (3-5 sentences) | Keeps UI unchanged, no new fields |
| Generation method | Batch pipeline script (no review gate) | Trust the pipeline, flag the duds |
| LLM backend | `lib/llm_router.py` with `preference="quality"` | Gemini Pro → Anthropic → Gemini Flash → Groq fallback chain |
| Scope | Top 500 by `best_role_score` | Covers the elite tier where intelligence adds most value |
| Pipeline 72 | Left as-is | New script `90_scouting_notes.py` owns this domain |

## Pipeline Script: `90_scouting_notes.py`

### Top-N Selection Query

```sql
SELECT p.id, p.name,
       EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
       pp.position, c.clubname AS club, n.name AS nation,
       pp.earned_archetype, pp.blueprint, pp.best_role, pp.best_role_score,
       pp.technical_score, pp.tactical_score, pp.mental_score, pp.physical_score,
       ppers.ei, ppers.sn, ppers.tf, ppers.jp,
       pm.market_value_tier, pm.transfer_fee_eur,
       ps.scouting_notes, ps.notes_flagged,
       p.height_cm, p.preferred_foot, pp.side
FROM people p
JOIN player_profiles pp ON pp.person_id = p.id
LEFT JOIN player_personality ppers ON ppers.person_id = p.id
LEFT JOIN player_market pm ON pm.person_id = p.id
LEFT JOIN player_status ps ON ps.person_id = p.id
LEFT JOIN clubs c ON c.id = p.club_id
LEFT JOIN nations n ON n.id = p.nation_id
WHERE pp.best_role_score IS NOT NULL
  AND p.active = true
ORDER BY pp.best_role_score DESC NULLS LAST
LIMIT %s
```

### Data Query (per player dossier)

For each player, query:

- **Identity**: name, age, position, club, nation, height, foot, side
- **Profile**: earned_archetype, blueprint, best_role, best_role_score
- **Grades**: top 5 strengths + bottom 3 weaknesses (highest-priority source from `attribute_grades`)
- **Pillar balance**: technical, tactical, mental, physical — converted to relative tiers (strong/moderate/limited), NOT raw numbers
- **Personality**: ei/sn/tf/jp scores converted to descriptive words (e.g. "extraverted, practical, competitive, spontaneous") — NO MBTI acronyms, NO coachability/competitiveness scores
- **Traits**: playing style traits from `player_trait_scores`
- **Market**: CS Value, market_value_tier (for relative positioning only)
- **Career**: trajectory label from `career_metrics`

### Pillar Tier Mapping

| Raw Score | Tier Label |
|-----------|------------|
| 70+       | strong     |
| 55-69     | moderate   |
| < 55      | limited    |

### Personality Descriptor Mapping

| Dimension | High (≥50) | Low (<50) |
|-----------|-----------|-----------|
| E/I       | extraverted | introverted |
| S/N       | practical | intuitive |
| T/F       | competitive | empathetic |
| J/P       | structured | spontaneous |

### Prompt Design

**System prompt:**

```
You are a football intelligence analyst writing scouting dossiers. Each note weaves three perspectives:

1. Scout: data-grounded assessment — strengths, weaknesses, archetype fit, pillar balance
2. Historian: tactical lineage — what tradition this player's role belongs to, what systems suit them
3. Director of Football: squad-building value — market position, what kind of club benefits most, risk factors

Rules:
- Write 3-5 sentences per player. Flowing prose, no bullet points, no headers.
- Be opinionated — name weaknesses, don't hedge.
- Use football language (half-spaces, progressive carries, inverted runs, etc).
- Never use clichés like "world-class talent" or "exciting prospect".
- Reference the player's archetype and best role naturally.
- ONLY use information provided in the dossier. Do NOT invent current-season context, match references, historical comparisons, or any facts not present in the input.
- Do not include raw numeric scores. Speak in relative terms.
- Do not reference MBTI types or personality acronyms.
```

**User prompt (per batch):**

```
Write scouting notes for these players. Return JSON: [{"name": "...", "notes": "..."}, ...]

---

Player: {name} ({age}, {position}, {club}, {nation})
Archetype: {earned_archetype} | Blueprint: {blueprint} | Best Role: {best_role}
Pillar Balance: technical={tier}, tactical={tier}, mental={tier}, physical={tier}
Personality: {descriptor1}, {descriptor2}, {descriptor3}, {descriptor4}
Strengths: {top 5 attribute names}
Weaknesses: {bottom 3 attribute names}
Traits: {trait1}, {trait2}, ...
Career: {trajectory} | Side: {side} | {height}cm | {foot} foot

---
[repeat for each player in batch]
```

### Missing Data Handling

Omit any line from the player dossier where data is NULL:
- **No grades**: Omit Strengths/Weaknesses lines entirely
- **No personality scores**: Omit Personality line
- **No traits**: Omit Traits line
- **No career_metrics**: Omit Career trajectory (keep Side/Height/Foot)
- **No pillar scores**: Omit Pillar Balance line
- **No earned_archetype**: Fall back to `archetype` field; if also NULL, omit

Players with fewer than 3 populated dossier lines beyond identity are skipped (insufficient context for quality notes). Logged as warnings.

### Batch Processing

- 10 players per LLM call (smaller batches than pipeline 72's 25 — richer context per player)
- `json_mode=True` for structured response parsing
- Inter-batch delay: 2 seconds (quality mode hits Gemini Pro first, not Groq)
- On parse failure: retry once, then skip batch and log

### CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--top N` | 500 | Number of players by `best_role_score` DESC |
| `--force` | false | Overwrite existing non-null notes |
| `--dry-run` | false | Print notes without writing to DB |
| `--player "Name"` | — | Single player mode |
| `--flagged-only` | false | Only re-generate players with `notes_flagged = true`, then clear flag |

### Upsert Logic

```sql
INSERT INTO player_status (person_id, scouting_notes, notes_flagged)
VALUES (%s, %s, false)
ON CONFLICT (person_id) DO UPDATE
SET scouting_notes = EXCLUDED.scouting_notes,
    notes_flagged = false,
    updated_at = now()
```

## Migration 048: `notes_flagged` Column

```sql
ALTER TABLE player_status ADD COLUMN IF NOT EXISTS notes_flagged boolean DEFAULT false;
```

Single column addition. No indexes needed (only queried by `--flagged-only` mode which filters a small set).

## API Change

In `/api/admin/player-update` route, add `notes_flagged` to the allowed fields for `player_status` table updates. No new endpoint needed.

## UI Change: Flag Button

**Location**: Player detail page, next to `ScoutingNotes` component.

**Behavior**:
- Admin-only (same `sessionStorage` check as other admin controls)
- Small flag icon button (outline when unflagged, filled amber when flagged)
- Tap toggles `notes_flagged` via existing `/api/admin/player-update`
- When flagged: scouting notes border changes from gold to amber
- Note: flag button only appears for players who have a `player_status` row (all top-500 will have one after the pipeline runs)

**No new components** — the flag button is added inline within the existing player detail layout.

## Example Output

**Input:**
```
Player: Vitinha (26, CM, Paris Saint-Germain, Portugal)
Archetype: Conjurer | Blueprint: Technical Midfielder | Best Role: Mezzala
Pillar Balance: technical=strong, tactical=strong, mental=moderate, physical=moderate
Personality: extraverted, practical, competitive, spontaneous
Strengths: balance, acceleration, take_ons, vision, through_balls
Weaknesses: heading, aerial_duels, strength
Traits: progressive_carrier, flamboyant, direct
Side: C | 172cm | Right foot
```

**Output:**
> A Conjurer who carries the ball like it's stitched to his boot — Vitinha's balance and acceleration make him almost impossible to dispossess in tight spaces, and his vision means the progressive pass is always on. Technically and tactically his strongest dimensions, though the mental and physical sides of his game sit a tier below, which can show in sustained physical battles. Extraverted and practical by nature, he thrives when given freedom to express himself rather than rigid positional discipline. His Mezzala profile makes him a premium asset for any side playing positional football, though clubs built around counter-pressing may find his physical limitations a liability.

## Out of Scope

- Changes to pipeline 72 (left as-is for legacy/bulk use)
- New UI pages or components beyond the flag button
- Automated scheduling (manual pipeline run for now)
- Historical comparison database (historian lens works from role/archetype context, not a lookup table)
