# Canonical Schema — Chief Scout

**Last updated:** 2026-03-08
**Database:** Supabase (PostgreSQL)
**Primary consumer:** Scouting Dashboard

---

## Tables

### `players`

The core player record. One row per player.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default `gen_random_uuid()` | |
| name | text | NOT NULL | Display name as-is from source |
| slug | text | UNIQUE, NOT NULL | Slugified name: lowercase, hyphens, no accents |
| dob | date | | Date of birth |
| nationality | text | | Country name or code |
| position | text | | Primary position from CSV |
| positions | text[] | | All known positions |
| club | text | | Current club |
| league | text | | Division / league name |
| level | int | | Overall rating |
| peak | int | | Peak rating |
| mentality | text | | Tactical mentality (e.g., Attacking, Balanced) |
| foot | text | | Preferred foot (L/R) |
| primary_class | text | | Primary archetype (e.g., Striker, Creator) |
| secondary_class | text | | Secondary archetype |
| model | text | | Player model type |
| physique | text | | Physical profile |
| character | text | | Character trait |
| base_value | bigint | | Value in pence (£1m = 100000000) |
| is_active | boolean | default `true` | Whether player is active in the game |
| created_at | timestamptz | default `now()` | |
| updated_at | timestamptz | default `now()` | Auto-updated via trigger |

---

### `player_attributes`

Attribute scores grouped into four JSONB domains. One row per player per import.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default `gen_random_uuid()` | |
| player_id | uuid | NOT NULL, FK → `players(id)` ON DELETE CASCADE | |
| mental | jsonb | | See domain mapping below |
| physical | jsonb | | See domain mapping below |
| tactical | jsonb | | See domain mapping below |
| technical | jsonb | | See domain mapping below |
| import_source | text | | Source identifier (e.g., "real_players_active") |
| imported_at | timestamptz | default `now()` | |

#### Domain Mapping

Values of `"Average"` in the CSV are stored as `null` (omitted from the JSONB object).

**mental** (14 attributes):

| CSV Column | JSONB Key |
|------------|-----------|
| Decisions | decisions |
| Composure | composure |
| Leadership | leadership |
| Communication | communication |
| Drive | drive |
| Discipline | discipline |
| Guile | guile |
| Vision | vision |
| Flair | flair |
| Anticipation | anticipation |
| Bravery | bravery |
| Concentraion | concentration |
| Awareness | awareness |
| Reactions | reactions |

**physical** (9 attributes):

| CSV Column | JSONB Key |
|------------|-----------|
| Stamina | stamina |
| Recovery | recovery |
| Pace | pace |
| Acceleration | acceleration |
| Agility | agility |
| Physicality | physicality |
| Jumping | jumping |
| Coordination | coordination |
| Balance | balance |

**tactical** (10 attributes):

| CSV Column | JSONB Key |
|------------|-----------|
| Tempo | tempo |
| Movement | movement |
| Pressing | pressing |
| Intensity | intensity |
| Marking | marking |
| Blocking | blocking |
| Positioning | positioning |
| Hold Up | hold_up |
| Duels | duels |
| Aggression | aggression |

**technical** (15 attributes):

| CSV Column | JSONB Key |
|------------|-----------|
| First Touch | first_touch |
| Set Piece | set_piece |
| Carries | carries |
| Penalty | penalty |
| Long | long_pass |
| Close | close_control |
| Through | through_ball |
| Range | range |
| Accuracy | accuracy |
| Cross | crossing |
| Takeons | take_ons |
| Skills | skills |
| Tackling | tackling |
| Aerial Duels | aerial_duels |
| Heading | heading |

---

### `player_stats`

Per-season statistical records. One row per player per season per club.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default `gen_random_uuid()` | |
| player_id | uuid | NOT NULL, FK → `players(id)` ON DELETE CASCADE | |
| season | text | NOT NULL | Format: "2024-25" |
| club | text | | Club during this season |
| league | text | | League during this season |
| appearances | int | | |
| minutes | int | | |
| goals | int | | |
| assists | int | | |
| xg | numeric(5,2) | | Expected goals |
| xa | numeric(5,2) | | Expected assists |
| raw | jsonb | | Full FBRef row, future-proofed |
| created_at | timestamptz | default `now()` | |

**Unique constraint:** `(player_id, season, club)`

---

### `scouting_profiles`

Structured scouting assessments. One row per scouting session per player.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default `gen_random_uuid()` | |
| player_id | uuid | NOT NULL, FK → `players(id)` ON DELETE CASCADE | |
| archetype_primary | text | | Primary archetype from scouting (e.g., Creator) |
| archetype_secondary | text | | Secondary archetype (e.g., Dribbler) |
| verdict | text | CHECK IN ('Benchmark','Monitor','Scout Further','Pass') | Scouting verdict |
| valuation_low | int | | Low end of valuation range |
| valuation_high | int | | High end of valuation range |
| personality_type | text | | e.g., "INSP - The Artist" |
| flags | text[] | | e.g., ['Unproven at Championship', 'Pace 4'] |
| notes | text | | Free-text scouting notes |
| version | int | default `1` | Profile version number |
| scouted_at | timestamptz | default `now()` | When scouting was performed |
| updated_at | timestamptz | default `now()` | Auto-updated via trigger |

---

## Security

- Row Level Security (RLS) enabled on all tables
- Policy: authenticated users can SELECT all rows
- Write access controlled by Supabase service role key (not exposed to clients)

## Triggers

- `set_updated_at()` trigger function updates `updated_at` on every UPDATE for `players` and `scouting_profiles`
