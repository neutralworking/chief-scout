# SACROSANCT — Chief Scout Classification Systems

> This is the single source of truth for all player classification, categorization, and taxonomy in Chief Scout. Every system, every type, every tag is defined here. If it's not here, it doesn't exist. If it contradicts something elsewhere, this document wins.

---

## Overview: Five Systems

| System | Question | Storage | Mutability | Assessment |
|--------|----------|---------|------------|------------|
| **Personality** | WHO is this player? | `player_personality` | Slow — character changes over years | Scout observation, behavioral inference |
| **Archetype** | HOW does this player play? | `player_profiles` | Medium — evolves with age/role | Attribute scores, statistical analysis |
| **Status** | WHAT is their current state? | `player_status` | Fast — changes week-to-week | News, match data, reports |
| **Tactical Roles** | WHERE do they fit in a formation? | `tactical_roles` | Stable — role definitions evolve slowly | Archetype + personality + position matching |
| **Four-Pillar Assessment** | OVERALL — how do they score? | Computed (API) | Real-time — recomputed on access | Technical + Tactical + Mental + Physical (25% each) |

These are **not interchangeable**. A Commander archetype can have any personality type. A General personality can play as any archetype. Status tags describe the now, not the forever. The four-pillar assessment synthesizes all systems into a unified score.

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

**Attribute scale**: All attributes are scored **0-10** (integer). This is the canonical scale for all attribute grades in `attribute_grades`.

**Sources**:
1. Scout grades (0-10, highest trust)
2. FBref statistical scores (0-10, high trust)
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

## System 4: Tactical Roles (WHERE)

Tactical roles describe **where and how a player functions within a formation**. Unlike positions (which are broad zones), roles are specific jobs within a system. A CM can be a Mezzala, Box-to-Box, or Deep Playmaker — the role determines what the formation asks of them.

### Role ↔ Archetype Affinity

Each role has a **primary** and **secondary** archetype affinity. Players whose archetype matches the role's affinity are naturally suited to it. This is computed, not assigned.

Role names use the term the football world actually uses. If the word came from Italian, Spanish, Portuguese, German, French, or Argentine football culture and became THE word for that role, we use it. No FIFA/FM generic compound names.

| Position | Role | Origin | Description | Primary | Secondary | Lineage |
|----------|------|--------|-------------|---------|-----------|---------|
| GK | Torwart | German | The traditional keeper — reflexes, positioning, commands area | GK | Cover | Banks → Zoff → Buffon → Courtois |
| GK | Sweeper Keeper | English | High line, sweeps behind defence, commands with authority | GK | Passer | Higuita → Neuer |
| GK | Ball-Playing GK | English | Distribution as a weapon — builds from back, short + long | GK | Controller | Ter Stegen → Ederson → Alisson |
| CD | Libero | Italian | Builds from back, reads danger, progressive passing | Cover | Passer | Beckenbauer → Sammer → Stones |
| CD | Vorstopper | German | "Front stopper" — aggressive, front-foot, wins duels | Destroyer | Powerhouse | Baresi → Nesta → Chiellini → Konaté |
| CD | Sweeper | English | Last man, covers space, reads play two moves ahead | Cover | Controller | Sammer → Hummels → Marquinhos |
| CD | Zagueiro | Brazilian | The commanding CB — physical dominance + vocal leadership | Destroyer | Commander | Lúcio → Thiago Silva → Van Dijk |
| WD | Lateral | Portuguese | The attacking fullback — wide + high, delivers | Engine | Dribbler | Cafu → Dani Alves → TAA |
| WD | Invertido | Spanish | Inverted FB — tucks inside in possession, becomes midfielder | Controller | Passer | Lahm (2013) → Cancelo → Rico Lewis |
| WD | Carrilero | Spanish | "Lane runner" — full-width both phases, tireless shuttle | Engine | Sprinter | Facchetti → Zanetti → Hakimi |
| DM | Sentinelle | French | The sentinel — shields back four, guards the gate | Cover | Destroyer | Makélélé → Busquets → Casemiro |
| DM | Regista | Italian | Deep playmaker, dictates tempo from in front of defence | Controller | Passer | Gerson (1970) → Pirlo → Jorginho |
| DM | Volante | Brazilian | "Steering wheel" — aggressive pressing, disrupts, recycles | Destroyer | Engine | Gattuso → Kanté → Caicedo |
| CM | Metodista | Italian | "The methodist" — orchestrates with precision from central zone | Controller | Passer | Xavi → Kroos → Pedri |
| CM | Tuttocampista | Italian | "All-pitch player" — covers ground end to end, arrives in box | Engine | Cover | Lampard → Gerrard → Bellingham |
| CM | Mezzala | Italian | "Half-winger" — half-space runner, creates from narrow positions | Passer | Creator | Barella |
| CM | Relayeur | French | "Relay player" — tireless shuttle, links phases | Engine | Destroyer | Valverde |
| WM | Fantasista | Italian | The wide creator — drifts inside, creates from half-spaces | Creator | Passer | Silva → Bernardo → Foden |
| WM | Winger | English | Touchline-hugging, direct, crosses — the oldest attacking role | Sprinter | Passer | Garrincha → Figo → Saka |
| WM | Raumdeuter | German | "Space interpreter" — arrives in dangerous positions | Dribbler | Striker | Thomas Müller (self-coined) |
| AM | Trequartista | Italian | The free-roaming 10, unpredictable genius | Creator | Dribbler | Baggio → Zidane → Messi |
| AM | Enganche | Argentine | "The hook" — stands still, sees everything, the pivot | Controller | Creator | Maradona → Riquelme → Dybala |
| AM | Seconda Punta | Italian | "Second striker" — late runs, between the lines | Dribbler | Striker | Del Piero → Müller → Havertz |
| WF | Inside Forward | English | Cuts inside on opposite foot, shoots — term from W-M era | Dribbler | Sprinter | Robben → Salah → Yamal |
| WF | Extremo | Portuguese | Wide attacker — stretches defence, pace weapon | Sprinter | Striker | Henry (wide) → Mbappé |
| WF | Inventor | English | The creator who makes something from nothing | Creator | Dribbler | Rui Costa (wide) → Grealish |
| CF | Prima Punta | Italian | "First striker" — holds up, aerial, reference point | Target | Powerhouse | Toni → Giroud → Dzeko |
| CF | Complete Forward | English | Does everything — scores AND creates, the total striker | Striker | Creator | R9 → Van Basten → Benzema |
| CF | Poacher | English | Goals, movement, instinct — lives in the box | Striker | Sprinter | Gerd Müller → Inzaghi → Haaland |
| CF | Falso Nove | Spanish | Drops deep, links play, creates space for runners | Creator | Controller | Hidegkuti (1953) → Messi (2009) → Firmino |
| CF | Seconda Punta | Italian | Between the lines, links midfield to attack | Dribbler | Striker | Totti → Griezmann → Dybala |

### Role Fit Scoring

A player's **role fit** is computed from their archetype model scores:

```
role_fit = (primary_model_score × 0.6) + (secondary_model_score × 0.4)
```

Normalized to 0-100. A score ≥ 70 = strong fit, 50-69 = adequate, < 50 = poor fit.

### Naming Conventions

- Roles are always **Title Case** — Regista, Ball-Playing CB, Inside Forward
- Roles are distinct from positions — a position is WHERE on the pitch, a role is WHAT you do there
- Roles belong to formations, not to players — a player has archetypes, a formation slot has a role

---

## System 5: Four-Pillar Assessment (OVERALL)

The unified assessment framework that synthesizes all other systems into four equally-weighted pillars (25% each), producing a single 0-100 overall score per player.

### The Four Pillars

| Pillar | Question | Color | CSS Variable | Primary Sources |
|--------|----------|-------|-------------|-----------------|
| **Technical** | How good are they? | Purple | `--color-accent-technical` | `attribute_grades` → 13 model scores → position-weighted compound |
| **Tactical** | How do they fit systems? | Green | `--color-accent-tactical` | Role fit + flexibility + trait profile |
| **Mental** | Who are they psychologically? | Blue | `--color-accent-mental` | Personality-role alignment + strength + stability |
| **Physical** | Are they available & durable? | Gold | `--color-accent-physical` | Age curve + availability (FBRef minutes) + trajectory |

### Pillar Computation

#### Technical (Purple)
- Position-weighted average of the 13 archetype model scores (from `POSITION_WEIGHTS`)
- Level-anchored: blended with `player_profiles.level` based on data quality weight
- Data quality weight ranges from 0.3 (EAFC-only) to 1.0 (scout-assessed)

#### Tactical (Green)
- **Role Fit (40%)**: Best tactical role score (from `scorePlayerForRole()`)
- **Flexibility (30%)**: Count of viable roles (score > 40% of max). 1 role=20, 3-4=50, 6+=80
- **Trait Profile (30%)**: Severity-scored traits matched against role demands via `TRAIT_ROLE_IMPACT`

#### Mental (Blue)
- **Personality-Role Alignment (50%)**: How well personality type matches best-fit role's personality preferences
- **Mental Strength (30%)**: `(competitiveness + coachability) / 2` from `player_personality`
- **Mental Stability (20%)**: From `player_status.mental_tag` (Sharp=100, Confident=75, Low=40, Fragile=15)

#### Physical (Gold)
- **Availability (40%)**: Minutes played / possible minutes from `fbref_player_season_stats` (last 3 seasons, recency-weighted)
- **Age Curve (35%)**: Position-specific peak windows. Within peak=100, each year below: -8, above: -10. Min 20.
- **Trajectory (25%)**: From `career_metrics.trajectory` (rising=90, peak=80, declining=35)
- **NOT speed/strength** — those are in Technical via Sprinter/Powerhouse models

### Age Curve Peak Windows

| Position | Peak Start | Peak End |
|----------|-----------|----------|
| GK | 27 | 34 |
| CD | 26 | 32 |
| WD | 25 | 30 |
| DM | 26 | 32 |
| CM | 25 | 31 |
| WM | 24 | 29 |
| AM | 24 | 30 |
| WF | 24 | 29 |
| CF | 25 | 31 |

### Trait Severity System

Traits stored in `player_trait_scores` with severity 1-10. Categories:

| Category | Traits |
|----------|--------|
| **Style** | flamboyant, direct, patient, elegant |
| **Physical** | long_throws, aerial_threat, endurance |
| **Tactical** | press_resistant, progressive_carrier, set_piece_specialist, positional_discipline, high_press, counter_attack_threat, build_up_contributor |
| **Behavioral** | big_game_player, inconsistent, clutch, hot_headed, quiet_leader |

Trait × Role impact is defined in `trait-role-impact.ts`. Positive impact = trait helps in this role, negative = hinders.

### Commercial/Career Modifier

Not a pillar — applied as a 0.7x to 1.5x multiplier on valuation:
- News buzz + sentiment from `news_sentiment_agg`
- Contract situation (months remaining)
- Trajectory premium/discount

### Confidence Levels

| Level | Meaning |
|-------|---------|
| **high** | All 4 pillars have real data sources |
| **medium** | 3 of 4 pillars have real data |
| **low** | 2 or fewer pillars have real data |

### Per-Screen Display Guidelines

| Screen | Pillar Focus | Display |
|--------|-------------|---------|
| Player Detail | All 4 pillars | Full dashboard with expandable breakdowns |
| Player List | Overall + spark bars | 4 micro-bars (purple/green/blue/gold) |
| Free Agents | Physical + Overall | Physical pillar score column (age curve + availability) |
| Formations | Tactical + Mental | Personality-role alignment indicator per assigned player |
| Editor | All (organized by pillar) | Technical (attributes), Tactical (traits), Mental (personality), Physical (fitness/contract) |

### API

`GET /api/players/[id]/assessment` returns `FullAssessment`:
- `pillars`: `{ technical, tactical, mental, physical, overall, confidence }`
- `technical`: Model scores, position score, data weight, sources
- `tactical`: Role fit, best role, flexibility, viable role count, trait profile
- `mental`: Personality-role alignment, mental strength, stability, personality type, mental tag
- `physical`: Availability, age curve, trajectory, age, trajectory label
- `commercial`: Multiplier, buzz, sentiment, contract months, trajectory bonus

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

### Pillar Interactions

| Interaction | Effect | Example |
|-------------|--------|---------|
| **Mental × Tactical** | Personality-role alignment boosts/penalizes tactical fit | Leader + Controller = strong Libero. Maverick in Anchor role = penalty |
| **Technical × Tactical** | `keyAttributes` per role enables precision fit | High Dribbler who lacks First Touch fails as Mezzala |
| **Physical × Value** | Age curve directly modifies commercial value | Veteran with strong Analytical personality gets intelligence bonus |
| **Traits × Roles** | Trait severity scores differentiate within archetypes | Two Controllers score differently for Regista if one is press_resistant:8 |

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
| Traits | `player_trait_scores` | `player_id` (FK → people) | Per-trait severity (1-10), category, source |

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
