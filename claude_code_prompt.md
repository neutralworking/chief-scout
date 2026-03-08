# Claude Code Prompt — Chief Scout Supabase SQL Generator

> **How to use:** Copy the prompt below and run it in a Claude Code session
> from inside the `/home/user/chief-scout` directory. It will read the game
> design files and generate/update the full Supabase migration SQL.

---

## Prompt

```
You are helping build Chief Scout, a Director of Football simulation RPG.
The project is at /home/user/chief-scout.

Read the following source files to understand the full game data:

1. /home/user/chief-scout/inbox/PlayerAttributes.csv
   — 52 player attributes organised by the 13 player model archetypes

2. /home/user/chief-scout/inbox/PlayerModels.gd
   — GDScript defining the 13 player model score variables and full attribute list

3. /home/user/chief-scout/inbox/DirectorAttributes.json
   — 10 director RPG attributes with descriptions and related staff roles

4. /home/user/chief-scout/inbox/TeamTacticalStyles.json
   — 9 team-level tactical styles (name + offensive/defensive style pairing)

5. /home/user/chief-scout/inbox/OffensiveTacticalStyles.json
   — 10 offensive tactical styles

6. /home/user/chief-scout/inbox/DefensiveTacticalStyles.json
   — 10 defensive tactical styles

7. /home/user/chief-scout/inbox/PlayingStyles.md
   — Style compatibility matrix: how easily players transition between styles,
     with adaptation times and performance modifiers

8. /home/user/chief-scout/inbox/AvailabilitySystem.md
   — Complete design document for the Availability system (the centrepiece).
     Read this thoroughly — it defines the 5-pillar scoring system, tier labels,
     all pillar weights, director attribute effects, and scouting pipeline integration.

9. /home/user/chief-scout/inbox/scratchpad.md
   — Scouting pipeline stages and director scoring KPIs

10. /home/user/chief-scout/inbox/scoutQueue.txt
    — Real examples of player transfer status fields (ClubStatus, NationStatus,
      TransferStatus, Playing Level, Potential Level)

11. /home/user/chief-scout/inbox/hallOfFame/league_2_halls_of_fame.json
    — 24 League Two clubs (4th tier) with modelClub names, formations, and
      historic XI player names

12. /home/user/chief-scout/supabase_migration.sql
    — The existing migration file. Read it in full before making any changes.

---

Your task is to EXTEND or UPDATE /home/user/chief-scout/supabase_migration.sql.

The existing migration already contains:
- All enum types (transfer_status_enum, squad_status_enum, player_model_enum, etc.)
- Core tables: player_models, attributes_master, nations, clubs, players, style_compatibility, model_style_affinity
- Scouting tables: shortlists, shortlist_entries, scout_reports, transfer_news
- Market tables: agents, agent_offers
- RPG table: director_attributes
- Views: players_availability_view, radar_view
- Functions: calculate_availability_score(), get_availability_tier(), calculate_style_fit_score()
- Indexes and RLS scaffolding
- Seed data for all 13 player models, 52 attributes, style compatibility matrix,
  model-style affinities, director attributes, 12 nations, 24 League Two clubs, 3 shortlists

Your job is to APPEND a new section to the migration file that adds:

## ADDITIONS TO IMPLEMENT:

### 1. Championship clubs (League One tier 2 equivalent — reputation 80-90)
Read /home/user/chief-scout/inbox/hallOfFame/epl_halls_of_fame.json and
/home/user/chief-scout/inbox/hallOfFame/league_1_halls_of_fame.json and
extract all club names, formation, modelClub, OffensiveStyle, DefensiveStyle.
Insert them as clubs with appropriate league_tier (1 for EPL, 2 for Championship,
3 for League One) and approximate reputation values:
- EPL clubs: reputation 90-100
- Championship clubs: reputation 80-89
- League One clubs: reputation 70-79

### 2. Hall of Fame historic XIs as players
For clubs that have P1–P11 player names filled in (not empty strings), insert
those players into the players table as historic/template players with:
- is_scouted = true (these are well-known)
- transfer_status = 'not_for_sale'
- squad_status = 'key_player'
- player_interest = 30
- No attribute values (attributes = '{}') — they're templates
- Link to the correct club via club_id

### 3. Transfer market events table
Add a new table transfer_market_events to track what triggers availability changes:

CREATE TABLE IF NOT EXISTS transfer_market_events (
  id              SERIAL PRIMARY KEY,
  player_id       INT REFERENCES players(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,  -- 'manager_sacked', 'contract_signed', 'injury', 'form_drop', 'listed', 'promotion', 'relegation'
  interest_delta  INT DEFAULT 0,  -- how much this event shifts player_interest (+/-)
  status_change   TEXT,           -- new transfer_status if changed
  description     TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### 4. Availability score history table
Add tracking for when a player's availability score changes meaningfully:

CREATE TABLE IF NOT EXISTS availability_score_history (
  id              SERIAL PRIMARY KEY,
  player_id       INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  score           INT NOT NULL,
  tier            availability_tier_enum NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avail_history_player ON availability_score_history(player_id, recorded_at DESC);

### 5. Saved searches table
For the Search functionality (directors save frequent searches):

CREATE TABLE IF NOT EXISTS saved_searches (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  filters         JSONB NOT NULL DEFAULT '{}',
  -- Example filters: {"position": "MID", "age_max": 25, "availability_tier": "WARM", "model": "Engine"}
  last_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### 6. Trigger to record availability score changes
Create a trigger that fires when a player's transfer_status, player_interest,
squad_status, or contract_expiry changes — it should call calculate_availability_score()
and insert a row into availability_score_history if the score has changed by ≥ 5 points
from the last recorded score.

### 7. Test the functions with realistic examples
After all inserts, add commented-out test queries at the bottom demonstrating:
- A HOT player (free agent, low squad status, high interest)
- A LOCKED player (key player, long contract, low interest, reputation gap)
- A WARM player (listed, mid-contract, neutral interest)
- The radar_view ordered by availability_score DESC
- A style fit score for an Engine player at a Gegenpress club

---

## Requirements:
- Use CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS throughout
- Use DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$; for new enum types
- Use INSERT ... ON CONFLICT DO NOTHING for all seed data
- Write all additions as a new clearly-labelled SECTION at the bottom of the existing file
- Do NOT rewrite or remove any existing content
- Format with clear section headers matching the existing style
- The file should be runnable as a single SQL script in the Supabase SQL editor
```

---

## Notes for Adapting This Prompt

**If you want to add your Supabase schema:** Before running the prompt, add this
line to the prompt:

```
Also read this existing Supabase schema and ensure all new tables are compatible
with it: [paste your schema here or reference a file path]
```

**If you want RLS policies:** Add this to the prompt:

```
Also write complete RLS policies for all tables using auth.uid() from Supabase Auth.
Assume each user has one save game. Add a user_id UUID column to shortlists,
saved_searches, and director_attributes tables and scope all policies to auth.uid().
```

**If you want TypeScript types generated:** Add this to the prompt:

```
After writing the SQL, also generate a TypeScript types file at
/home/user/chief-scout/types/database.ts containing TypeScript interfaces
for all tables, matching the Supabase generated types format.
```

**To re-run from scratch (destructive):** Prepend this to the prompt:

```
First, drop all Chief Scout tables if they exist (in reverse dependency order),
then recreate everything from scratch. List each dropped table before dropping it.
```
