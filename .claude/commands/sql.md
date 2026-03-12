# /sql — Remote SQL Console

Run SQL queries against the Chief Scout database via the deployed admin API. Works from any device including iOS.

## How It Works
Send SQL to `https://chief-scout.vercel.app/api/admin/sql` via POST.

- SELECT/WITH/EXPLAIN → returns JSON rows
- INSERT/UPDATE/DELETE/CREATE → returns affected row count
- Service role only (no public access)

## Usage
Given `$ARGUMENTS`:

1. Parse the user's request into a SQL query
2. Execute it via WebFetch to the admin API
3. Format and display the results

## Execution

Use the WebFetch tool to POST to the admin API. Auth is required via Bearer token using CRON_SECRET from the environment.

```
POST https://chief-scout.vercel.app/api/admin/sql
Content-Type: application/json
Authorization: Bearer <CRON_SECRET from .env.local>

{"sql": "<the query>"}
```

Read CRON_SECRET from `/Users/solid-snake/Documents/chief-scout/apps/player-editor/.env.local` (grep for CRON_SECRET). Include it as `Authorization: Bearer <value>` header.

## Schema Reference
- `people` — name, dob, height_cm, preferred_foot, nation_id, club_id, active, wikidata_id
- `player_profiles` — person_id, position, secondary_position, level, peak, overall, archetype
- `player_status` — person_id, squad_role, pursuit_status, loan_status
- `player_market` — person_id, market_value_tier, true_mvt, transfer_fee_eur
- `player_personality` — person_id, ei, sn, tf, jp, competitiveness, coachability
- `attribute_grades` — player_id, attribute, scout_grade, stat_score, source
- `player_tags` + `tags` — tag assignments (tag_name, category)
- `clubs` — name, nation_id, league_name, stadium, wikidata_id
- `players` view — read-only compat view joining people + profiles + status + market
- Position enum: GK, WD, CD, DM, CM, WM, AM, WF, CF

## Examples
- `/sql SELECT name, level, peak FROM players WHERE level >= 88 ORDER BY level DESC`
- `/sql UPDATE player_status SET pursuit_status = 'Priority' WHERE person_id = 123`
- `/sql SELECT tag_name, COUNT(*) FROM player_tags pt JOIN tags t ON t.id = pt.tag_id GROUP BY tag_name ORDER BY count DESC LIMIT 20`

## Output
- For queries: display results as a formatted table
- For mutations: report affected row count
- Always show the SQL that was executed
