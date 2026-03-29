# SACROSANCT — Chief Scout Classification Systems

> This is the single source of truth for all player classification, categorization, and taxonomy in Chief Scout. Every system, every type, every tag is defined here. If it's not here, it doesn't exist. If it contradicts something elsewhere, this document wins.

---

## Overview: Five Systems

| System | Question | Storage | Mutability | Assessment |
|--------|----------|---------|------------|------------|
| **Personality** | WHO is this player? | `player_personality` | Slow — character changes over years | Scout observation, behavioral inference |
| **Archetype** | HOW does this player play? | `player_profiles` | Medium — evolves with age/role | Attribute scores, statistical analysis |
| **Status** | WHAT is their current state? | `player_status` | Fast — changes week-to-week | News, match data, reports |
| **Tactical Roles** | WHERE do they fit in a formation? | `tactical_systems`, `system_slots`, `slot_roles` | Stable — role definitions evolve slowly | Archetype + personality + position matching |
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
| ANLC | **The General** | Reads the game analytically. Self-driven. Organises others. Thrives when it matters most. | General |
| ANSC | **The Machine** | Systematic reader of the game. Self-motivated. Quiet but relentless. Consistently delivers. | General |
| INSC | **The Mamba** | Instinctive. Self-driven. Self-reliant. Strikes with precision and competitive edge. | General |
| AXLC | **The Catalyst** | Analytical mind fuelled by atmosphere. Demands attention. Leads through confrontation. | Catalyst |
| IXSC | **The Maverick** | Flair player who needs the big stage. Self-focused. Rises to confrontation. | Catalyst |
| IXLC | **The Livewire** | Improviser fuelled by occasion. Leads vocally. Thrives on confrontation. | Catalyst |
| INSP | **The Maestro** | Creative and self-motivated. Quietly brilliant. Composed under pressure. | Maestro |
| ANLP | **The Conductor** | Tactical organiser. Self-driven. Leads through control. Ice-cold composure. | Maestro |
| IXSP | **The Genius** | Improviser who lives for the occasion. Self-contained. Ice-cold under pressure. | Maestro |
| INLC | **The Captain** | Instinct-driven. Self-motivated. Vocal leader. Fierce competitor who sets the standard. | Captain |
| INLP | **The Guardian** | Instinctive. Self-motivated. Vocal organiser. A calm and steady presence. | Captain |
| AXSC | **The Enforcer** | Reads patterns. Fuelled by the occasion. Self-focused. Aggressive competitor. | Catalyst |
| ANSP | **The Professor** | Analytical. Self-motivated. Self-contained. Composed under the highest pressure. | Professor |
| AXSP | **The Technician** | Structured thinker. Occasion-driven. Self-contained. Calm under pressure. | Professor |
| IXLP | **The Playmaker** | Creative improviser. Occasion-driven. Organises play. Composed decision-maker. | Professor |
| AXLP | **The Orchestrator** | Tactical mind who feeds off the crowd. Organises others. Composed and decisive. | Professor |

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
| **Catalyst** | AXLC, IXSC, IXLC | Carnival: fuchsia-amber gradients, rounded-2xl, bold italic gradient text |
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
| Technical | Dribbler, Passer, Striker | Gold | `--color-accent-technical` |
| Tactical | Cover, Engine, Destroyer | Purple | `--color-accent-tactical` |
| Mental | Controller, Commander, Creator | Green | `--color-accent-mental` |
| Physical | Target, Sprinter, Powerhouse | Blue | `--color-accent-physical` |

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

Tactical roles describe **where and how a player functions within a formation**. Unlike positions (which are broad zones), roles are specific jobs within a system. A CM can be a Mezzala, Metodista, or Tuttocampista — the role determines what the formation asks of them.

**Full spec**: `docs/superpowers/specs/2026-03-29-systems-and-roles-design.md`

### Hierarchy

```
Philosophy → System → Formation → Slot → Role(s)
```

| Level | Description | Storage |
|-------|-------------|---------|
| **Philosophy** | Tactical DNA — the overarching approach (e.g. Gegenpressing, Tiki-Taka) | `tactical_philosophies` |
| **System** | Named tactical system within a philosophy (e.g. 4-3-3 Gegenpressing) | `tactical_systems` |
| **Formation** | Shape — the numeric layout (e.g. 4-3-3, 4-2-3-1) | `formations` |
| **Slot** | A positional role-slot in a formation (e.g. Left Wing, Pivot DM) | `system_slots` |
| **Role** | The specific job assigned to that slot (e.g. Inside Forward, Anchor) | `slot_roles` |

Roles are validated **bottom-up**: every role in this taxonomy exists in at least one real tactical system. No role is invented to fill a grid.

### The 41 Roles

Role names use the term the football world actually uses. If the word came from Italian, Spanish, Portuguese, German, French, or Argentine football culture and became THE word for that role, we use it. No FIFA/FM generic compound names.

Each role's **primary model** determines its pillar alignment:
- **Technical** (Gold): Dribbler, Passer, Striker
- **Tactical** (Purple): Cover, Engine, Destroyer
- **Mental** (Green): Controller, Commander, Creator
- **Physical** (Blue): Target, Sprinter, Powerhouse

**GK exception**: The specialist GK model is always primary. The secondary model determines pillar alignment for goalkeeper roles.

#### GK (4 roles)

| Role | Description |
|------|-------------|
| **Comandante** | Organizer — commands the area, marshals the backline. Banks → Buffon → Casillas |
| **Sweeper Keeper** | High line, sweeps behind defence, reads danger early. Higuita → Neuer → Alisson |
| **Distributor** | Distribution specialist — builds attacks from the back. Ter Stegen → Ederson |
| **Shotstopper** | Reflexes, presence, dominates the six-yard box. Kahn → Courtois → Onana |

#### CD (5 roles)

| Role | Description |
|------|-------------|
| **Centrale** | Ball-playing CB — progressive passing from deep. Beckenbauer → Sammer → Stones |
| **Distributor** | Pass-first CB who recycles possession and switches play |
| **Stopper** | Aggressive front-foot defender — wins duels, dominates. Baresi → Chiellini → Konate |
| **Sweeper** | Last man — reads play two moves ahead, covers space. Sammer → Hummels → Marquinhos |
| **Colossus** | Commanding CB — leads, organizes, sets the defensive tone. Lucio → Thiago Silva → Van Dijk |

#### WD (4 roles)

| Role | Description |
|------|-------------|
| **Fullback** | Attacking fullback — crosses, final ball, width. Cafu → Dani Alves → TAA |
| **Wing-back** | Covers full flank in both phases, tireless discipline. Facchetti → Zanetti → Hakimi |
| **Corner Back** | Defensive-first fullback who holds position and protects the channel |
| **Invertido** | Inverted FB — reads when to tuck inside, becomes midfielder. Lahm (2013) → Cancelo → Rico Lewis |

#### DM (5 roles)

| Role | Description |
|------|-------------|
| **Regista** | Deep playmaker — dictates tempo with passing quality. Gerson (1970) → Pirlo → Jorginho |
| **Pivote** | Midfield brain — organizes shape, reads everything. Busquets → Rodri → Fernandinho |
| **Anchor** | Shield — positions, intercepts, guards the gate. Makelele → Busquets → Casemiro |
| **Ball Winner** | Ball-winner — aggressive, physical, disrupts. Gattuso → Kante → Caicedo |
| **Segundo Volante** | Dynamic DM who arrives late into the box from deep |

#### CM (4 roles)

| Role | Description |
|------|-------------|
| **Playmaker** | Half-space creator — technical quality between the lines. Barella → Kovacic → Modric |
| **Metodista** | Orchestrator — controls rhythm with intelligent passing. Xavi → Kroos → Pedri |
| **Mezzala** | Half-space runner — breaks lines, links wide and central. Barella → Valverde |
| **Tuttocampista** | All-pitch midfielder — covers every blade, arrives in box. Lampard → Gerrard → Bellingham |

#### WM (4 roles)

| Role | Description |
|------|-------------|
| **Winger** | Beats defenders with skill and trickery, delivers from wide. Garrincha → Figo → Saka |
| **Tornante** | Full-flank wide mid — works both phases, selfless. Maggio → Moses → Kostic |
| **False Winger** | Starts wide, drifts inside intelligently to create overloads. Bernardo Silva → Foden → Kulusevski |
| **Wide Playmaker** | Creative wide presence — combines in tight spaces, picks passes from the flank |

#### AM (3 roles)

| Role | Description |
|------|-------------|
| **Trequartista** | Free-roaming 10 — dribbling genius in the final third. Baggio → Zidane → Messi |
| **Enganche** | The hook — sees everything, threads impossible passes. Maradona → Riquelme → Dybala |
| **Boxcrasher** | Dynamic AM who arrives in the box with pace and power. Havertz → Bruno Fernandes |

#### WF (5 roles)

| Role | Description |
|------|-------------|
| **Inside Forward** | Cuts inside on strong foot to shoot or create. Robben → Salah → Yamal |
| **Raumdeuter** | Space interpreter — presses and finds pockets to score. Thomas Muller → Son → Mane |
| **Winger** | Wide forward who runs channels, crosses and stretches the defence |
| **Wide Playmaker** | Creates from wide with vision and combination play. Grealish → Neymar |
| **Wide Target Forward** | Physical wide forward — holds up play, brings others into the game |

#### CF (7 roles)

| Role | Description |
|------|-------------|
| **Prima Punta** | The main striker — clinical finisher, wins headers, occupies CBs. Gerd Müller → Lewandowski → Kane |
| **Complete Forward** | All-round striker — contributes to build-up, holds up, finishes. Lewandowski → Benzema |
| **Falso Nove** | False 9 — drops deep, creates, pulls CBs out of shape. Hidegkuti (1953) → Messi (2009) |
| **Spearhead** | Leads the press from front, relentless work rate. Firmino → Vardy → Suarez |
| **Target Forward** | Aerial, holds up, physical reference point. Toni → Giroud → Lacazette |
| **Seconda Punta** | Second striker — reads space, links play through movement. Del Piero → Griezmann → Firmino |
| **Shadow Striker** | Arrives late from deep, ghosting in behind the target man. Totti → Sneijder → Gotze |

### Role Fit Scoring

A player's **role fit** is computed from their archetype model scores:

```
role_fit = (primary_model_score × 0.6) + (secondary_model_score × 0.4)
```

Normalized to 0-100. A score ≥ 70 = strong fit, 50-69 = adequate, < 50 = poor fit.

### Naming Conventions

- Roles are always **Title Case** — Regista, Inside Forward, False Winger
- Roles are distinct from positions — a position is WHERE on the pitch, a role is WHAT you do there
- Roles belong to formations, not to players — a player has archetypes, a formation slot has a role
- Role names use cultural football terms where established; coined English terms where no cultural term exists
- Every role must be validated against at least one real tactical system (bottom-up validation)

---

## System 5: Four-Pillar Assessment (OVERALL)

The unified assessment framework that synthesizes all other systems into four equally-weighted pillars (25% each), producing a single 0-100 overall score per player.

### The Four Pillars

| Pillar | Question | Color | CSS Variable | Primary Sources |
|--------|----------|-------|-------------|-----------------|
| **Technical** | How good are they? | Gold | `--color-accent-technical` | `attribute_grades` → 13 model scores → position-weighted compound |
| **Tactical** | How do they fit systems? | Purple | `--color-accent-tactical` | Role fit + flexibility + trait profile |
| **Mental** | Who are they psychologically? | Green | `--color-accent-mental` | Personality-role alignment + strength + stability |
| **Physical** | Are they available & durable? | Blue | `--color-accent-physical` | Age curve + availability (FBRef minutes) + trajectory |

### Pillar Computation

#### Technical (Gold)
- Position-weighted average of the 13 archetype model scores (from `POSITION_WEIGHTS`)
- Level-anchored: blended with `player_profiles.level` based on data quality weight
- Data quality weight ranges from 0.3 (EAFC-only) to 1.0 (scout-assessed)

#### Tactical (Purple)
- **Role Fit (40%)**: Best tactical role score (from `scorePlayerForRole()`)
- **Flexibility (30%)**: Count of viable roles (score > 40% of max). 1 role=20, 3-4=50, 6+=80
- **Trait Profile (30%)**: Severity-scored traits matched against role demands via `TRAIT_ROLE_IMPACT`

#### Mental (Green)
- **Personality-Role Alignment (50%)**: How well personality type matches best-fit role's personality preferences
- **Mental Strength (30%)**: `(competitiveness + coachability) / 2` from `player_personality`
- **Mental Stability (20%)**: From `player_status.mental_tag` (Sharp=100, Confident=75, Low=40, Fragile=15)

#### Physical (Blue)
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
