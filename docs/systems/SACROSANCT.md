# SACROSANCT — Chief Scout Classification Systems

> This is the single source of truth for all player classification, categorization, and taxonomy in Chief Scout. Every system, every type, every tag is defined here. If it's not here, it doesn't exist. If it contradicts something elsewhere, this document wins.

---

## Overview: Three Systems, Three Questions

| System | Question | Storage | Mutability | Assessment |
|--------|----------|---------|------------|------------|
| **Personality** | WHO is this player? | `player_personality` | Slow — character changes over years | Scout observation, behavioral inference |
| **Archetype** | HOW does this player play? | `player_profiles` | Medium — evolves with age/role | Attribute scores, statistical analysis |
| **Status** | WHAT is their current state? | `player_status` | Fast — changes week-to-week | News, match data, reports |

These are **not interchangeable**. A Commander archetype can have any personality type. A General personality can play as any archetype. Status tags describe the now, not the forever.

---

## System 1: Personality (WHO)

### The Football Personality Matrix

Four dichotomies scored 0-100 on each axis. The threshold is 50. Above = first letter, below = second letter.

| Dimension | High (≥50) | Low (<50) | What it measures |
|-----------|-----------|----------|------------------|
| **Game Reading** | **A** — Analytical | **I** — Instinctive | How the player processes the game. Pattern recognition vs. improvisation. |
| **Motivation** | **X** — Extrinsic | **N** — Intrinsic | What drives their effort. Crowd/occasion vs. internal standards. |
| **Social Orientation** | **S** — Soloist | **L** — Leader | How they relate to teammates. Self-contained vs. organizing others. |
| **Pressure Response** | **C** — Competitor | **P** — Composer | Behavior under pressure. Confrontation vs. composure. |

### The 16 Personality Types

| Code | Name | One-liner | Theme |
|------|------|-----------|-------|
| ANLC | **The General** | Structured reader, self-driven, organizes others, thrives in confrontation | General |
| ANSC | **The Machine** | Reads the game systematically, self-motivated, quiet but relentless | General |
| INSC | **The Hunter** | Instinctive, self-driven, self-reliant, competitive edge | General |
| AXLC | **The Showman** | Structured but feeds off atmosphere, demands attention, confrontational | Showman |
| IXSC | **The Maverick** | Flair player, needs the big stage, self-focused, rises to confrontation | Showman |
| IXLC | **The Provocateur** | Improviser, occasion-driven, leads vocally, thrives on confrontation | Showman |
| INSP | **The Maestro** | Creative, self-motivated, quietly brilliant, composed under pressure | Maestro |
| ANLP | **The Conductor** | Tactical organizer, self-driven, leads through control, ice-cold composure | Maestro |
| IXSP | **The Genius** | Improviser, occasion-driven, self-contained, ice-cold under pressure | Maestro |
| INLC | **The Captain** | Instinct-driven, self-motivated, vocal leader, fierce competitor | Captain |
| INLP | **The Guardian** | Instinctive, self-motivated, vocal organizer, calm presence | Captain |
| AXSC | **The Enforcer** | Reads patterns, fuelled by occasion, self-focused, aggressive competitor | Captain |
| ANSP | **The Professor** | Analytical, self-motivated, self-contained, composed under pressure | Professor |
| AXSP | **The Technician** | Structured, occasion-driven, self-contained, calm under pressure | Professor |
| IXLP | **The Playmaker** | Creative improviser, occasion-driven, organizes play, composed | Professor |
| AXLP | **The Orchestrator** | Tactical mind, feeds off the crowd, organizes others, composed decision-maker | Professor |

### Standalone Traits

In addition to the 4-letter code, two standalone traits are scored 0-100:

| Trait | What it measures | Assessment method |
|-------|-----------------|-------------------|
| **Competitiveness** | Intensity of competitive drive, desire to win individual duels and matches | Scout observation: reaction to losing, effort in training, response to setbacks |
| **Coachability** | Receptiveness to tactical instruction, willingness to adapt, learning speed | Scout observation: tactical changes mid-match, relationship with coaching staff |

These are **traits**, not tags. They are measured on a continuous scale and change slowly over a career. They exist on `player_personality` alongside the dichotomy scores.

### Card Visual Themes

Personality type drives the visual treatment of player cards in the UI:

| Theme | Types | Visual motif |
|-------|-------|-------------|
| **General** | ANLC, ANSC, INSC | Helvetica business card: clean lines, zinc palette, sharp borders, tracked uppercase |
| **Showman** | AXLC, IXSC, IXLC | Carnival: fuchsia-amber gradients, rounded-2xl, bold italic gradient text |
| **Maestro** | INSP, ANLP, IXSP | Silk: muted gold borders, refined italic typography, understated elegance |
| **Captain** | INLC, INLP, AXSC | Military: bold red left stripe, extrabold uppercase, commanding presence |
| **Professor** | ANSP, AXSP, IXLP, AXLP | Blueprint: blue monospace accents, technical borders, precise layout |

### Assessment Methodology

**Primary**: Scout observation across multiple matches.

**Inference sources** (when no manual assessment exists):
1. On-pitch behavior — positional discipline vs. creative wandering (I/A)
2. Performance consistency — same output in dead rubbers and cup finals (N/X)
3. Communication patterns — vocal organizer vs. quiet executor (L/S)
4. Pressure response — cards per 90, response to fouls, composure on ball (C/P)
5. EAFC data — PlayStyles, work rates, skill moves (low confidence)
6. Career patterns — loyalty vs. big moves (N/X indicator)

Always label inferred assessments as `[Inferred]`.

---

## System 2: Archetype (HOW)

### The 13 Playing Models

Every player is scored 0-100 on all 13 models. The highest score determines their **primary archetype**. A secondary archetype may also be noted.

| Category | Model | Core Attributes (4 each) | Typical Positions |
|----------|-------|--------------------------|-------------------|
| **Mental** | Controller | Anticipation, Composure, Decisions, Tempo | Regista, deep playmaker |
| **Mental** | Commander | Communication, Concentration, Drive, Leadership | Captain, experienced CB/GK |
| **Mental** | Creator | Creativity, Guile, Unpredictability, Vision | No. 10, advanced playmaker |
| **Physical** | Target | Aerial Duels, Heading, Jumping, Volleys | Target striker, aerial CB |
| **Physical** | Sprinter | Acceleration, Balance, Movement, Pace | Winger, inside forward |
| **Physical** | Powerhouse | Aggression, Duels, Shielding, Throwing | Ball-winning mid, target man |
| **Tactical** | Cover | Awareness, Discipline, Interceptions, Positioning | Sweeper, DM, covering CB |
| **Tactical** | Engine | Intensity, Pressing, Stamina, Versatility | Box-to-box, wing-back |
| **Tactical** | Destroyer | Blocking, Clearances, Marking, Tackling | Ball-winning DM, aggressive CB |
| **Technical** | Dribbler | Carries, First Touch, Skills, Take-ons | Winger, no. 10, mezzala |
| **Technical** | Passer | Pass Accuracy, Crossing, Pass Range, Through Balls | Deep playmaker, full-back |
| **Technical** | Striker | Short Range, Mid Range, Long Range, Penalties | Striker, second striker |
| **Specialist** | GK | Agility, Footwork, Handling, Reactions | Goalkeeper |

### Compound Categories & Colors

| Compound | Models | UI Color | CSS Variable |
|----------|--------|----------|-------------|
| Mental | Controller, Commander, Creator | Blue | `--accent-mental` |
| Physical | Target, Sprinter, Powerhouse | Amber | `--accent-physical` |
| Tactical | Cover, Engine, Destroyer | Green | `--accent-tactical` |
| Technical | Dribbler, Passer, Striker | Purple | `--accent-technical` |

### Archetype Confidence

| Level | Meaning | Displayed as |
|-------|---------|-------------|
| high | Multiple data sources agree, scout-assessed | 3/4 dots |
| medium | Statistical inference with some scout validation | 2/4 dots |
| low | Single source or inferred from limited data | 1/4 dots |

### Assessment Methodology

**Primary**: Aggregate attribute grades across the 4 core attributes per model.

**Sources**:
1. Scout grades (1-20 scale, highest trust)
2. FBref statistical scores (high trust)
3. EAFC sub-attributes (baseline, ×0.3 trust weight)

Model scores are computed, not assigned. The archetype emerges from the attribute profile.

---

## System 3: Status Tags

Mutable state descriptors on `player_status`. These change frequently based on current events.

### Tag Categories

| Tag | Valid Values | Default | What it tracks |
|-----|-------------|---------|---------------|
| `fitness_tag` | Fully Fit, Minor Knock, Injured, Long-Term | Fully Fit | Physical availability |
| `mental_tag` | Sharp, Confident, Low, Fragile | Sharp | Psychological state |
| `disciplinary_tag` | Clear, Cautioned, Suspended, Volatile | Clear | Card/ban status |
| `tactical_tag` | Adaptable, Specialist, Limited, Versatile | Adaptable | Tactical flexibility |
| `contract_tag` | Long-Term, One Year Left, Six Months, Expired, Extension Talks | One Year Left | Contract situation |

### Status Fields (not tags)

These are free-form or enum fields, not categorical tags:

| Field | Type | Values |
|-------|------|--------|
| `pursuit_status` | enum | Pass, Watch, Interested, Priority |
| `scouting_notes` | text | Free-form scouting commentary |
| `squad_role` | text | e.g. "First XI", "Rotation", "Youth" |
| `loan_status` | text | e.g. "On Loan", "Loan Return", null |
| `club_status` | text | Current club context |
| `nation_status` | text | International status |
| `transfer_status` | text | Transfer market status |

### Tags vs Traits vs Dichotomies

| Concept | Type | Scale | Where | Mutability |
|---------|------|-------|-------|------------|
| **Tags** | Categorical | Fixed set of labels | `player_status` | Fast (weekly) |
| **Traits** | Continuous | 0-100 numeric | `player_personality` | Slow (career-arc) |
| **Dichotomies** | Spectrum | 0-100, split at 50 | `player_personality` | Slow (career-arc) |
| **Archetype** | Computed | 0-100 per model | `player_profiles` | Medium (seasonal) |

**Decision framework** for new classifications:
- Does it change week-to-week? → **Tag** on `player_status`
- Is it a measurable characteristic on a spectrum? → **Trait** on `player_personality`
- Does it describe a binary behavioral tendency? → **Dichotomy** (add new dimension to personality matrix)
- Does it describe how they play technically/tactically/physically? → **Attribute** feeding into archetype models

---

## System Interactions

### Personality × Archetype

Personality and archetype are orthogonal. Any personality can appear with any archetype. But certain combinations create emergent identities:

| Combination | Emergent identity | Example |
|-------------|-------------------|---------|
| General + Commander | The born leader — structured, self-driven, organizes the defense | Virgil van Dijk |
| Maverick + Dribbler | The entertainer — flair on and off the ball, occasion-driven | Neymar |
| Machine + Engine | The perpetual motion — relentless, systematic, never stops | Kanté |
| Maestro + Creator | The artist — quietly brilliant, sees passes nobody else sees | Messi |
| Captain + Destroyer | The warrior — leads from the front, aggressive, vocal | Roy Keane |

### Personality × Playing Style

| Playing Style | Best personality fit | Why |
|---------------|---------------------|-----|
| Gegenpressing | C (Competitor) + N (Intrinsic) | Intensity sustained by internal drive |
| Tiki-Taka | A (Analytical) + P (Composer) | Positional discipline + calm under press |
| Counter-Attack | I (Instinctive) + C (Competitor) | Transition decisions + defensive commitment |
| Joga Bonito | I (Instinctive) + S (Soloist) | Creative freedom, individual expression |
| Catenaccio | A (Analytical) + N (Intrinsic) + L (Leader) | Disciplined shape + vocal organization |

### Status × Pursuit

Status tags inform pursuit decisions:
- `fitness_tag: Long-Term` → pursuit drops to Watch regardless of quality
- `contract_tag: Six Months` → pursuit may escalate (value opportunity)
- `mental_tag: Fragile` → pursuit should factor culture-fit risk

---

## Database Reference

| System | Table | Key Column | Related |
|--------|-------|------------|---------|
| Personality | `player_personality` | `person_id` (FK → people) | ei, sn, tf, jp, competitiveness, coachability |
| Archetype | `player_profiles` | `person_id` (FK → people) | archetype, model_id, blueprint, profile_tier |
| Status | `player_status` | `person_id` (FK → people) | fitness_tag, mental_tag, etc. |
| Attributes | `attribute_grades` | `player_id` (FK → people) | Per-attribute scout_grade, stat_score |
| Tags | `player_tags` | `player_id` (FK → people) | Generic tag associations |
| Sources | `player_field_sources` | `player_id` (FK → people) | Data provenance |

### Key Views

| View | Purpose |
|------|---------|
| `player_intelligence_card` | Single-query dossier: identity + profile + personality + market + status |
| `personality_style` | WHO (personality) + HOW (archetype) combined view |

---

## Naming Conventions

- Personality types are always **"The [Name]"** — The General, The Maestro, etc.
- Archetypes are always **bare noun** — Controller, Dribbler, Engine (no "The")
- Status tags are always **Title Case** — Fully Fit, One Year Left
- Trait names are always **lowercase** — competitiveness, coachability
- Position codes are always **UPPERCASE** — GK, CD, WD, DM, CM, WM, AM, WF, CF
