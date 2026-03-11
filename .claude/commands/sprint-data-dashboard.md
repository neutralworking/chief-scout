# Sprint: External Data Dashboard + DB Reseed

You are running a sprint to accomplish three goals:
1. **Merge** the `claude/daily-planning-session-Nzxg6` branch into `main` and push
2. **Reseed** the database to bring it from 23 → 50 full player profiles
3. **Add external data stats** (StatsBomb, Understat, FBRef) to the main dashboard

## Step 1: Merge to main

```bash
git fetch origin main
git checkout main
git merge origin/claude/daily-planning-session-Nzxg6 --no-edit
git push origin main
```

If merge conflicts occur, resolve them favouring the feature branch.

## Step 2: Reseed database (50 profiles)

Run the seed script to upsert all 50 profiles into Supabase:

```bash
cd pipeline
python 14_seed_profiles.py
```

This writes to: `people`, `player_profiles`, `player_personality`, `player_market`, `player_status`, `attribute_grades`. Confirm the output shows 50 profiles inserted/updated. If there's an error about missing `POSTGRES_DSN`, check that `.env` or `.env.local` exists in the repo root with `POSTGRES_DSN` set.

After seeding, verify counts:
```sql
SELECT count(*) FROM player_profiles WHERE profile_tier = 1;
-- Expected: 50
```

## Step 3: Add external data widgets to dashboard

Edit `apps/player-editor/src/app/page.tsx` to add a new **"External Data Sources"** widget to the dashboard.

### Data to query

Add these counts to the `getDashboardData()` function:

```typescript
// StatsBomb
const sbCompResult = await supabaseServer
  .from("sb_competitions")
  .select("competition_id", { count: "exact", head: true });
const sbMatchResult = await supabaseServer
  .from("sb_matches")
  .select("match_id", { count: "exact", head: true });
const sbEventResult = await supabaseServer
  .from("sb_events")
  .select("id", { count: "exact", head: true });

// Understat
const usMatchResult = await supabaseServer
  .from("understat_matches")
  .select("id", { count: "exact", head: true });
const usPlayerResult = await supabaseServer
  .from("understat_player_match_stats")
  .select("id", { count: "exact", head: true });

// FBRef
const fbrefPlayerResult = await supabaseServer
  .from("fbref_players")
  .select("fbref_id", { count: "exact", head: true });
const fbrefStatsResult = await supabaseServer
  .from("fbref_player_season_stats")
  .select("id", { count: "exact", head: true });
const fbrefLinkedResult = await supabaseServer
  .from("player_id_links")
  .select("person_id", { count: "exact", head: true })
  .eq("source", "fbref");
```

### Widget design

Add a new card below the existing Quick Stats widget. Use the same design language as the rest of the dashboard (dark surface, muted labels, mono values). Structure:

**"Data Sources"** — 3-column grid (one per source):

| StatsBomb | Understat | FBRef |
|---|---|---|
| Competitions: {count} | Matches: {count} | Players: {count} |
| Matches: {count} | Player Stats: {count} | Season Stats: {count} |
| Events: {count} | | Linked: {count} / {total people} |

Each source column should have:
- A heading with the source name (small, uppercase, tracked like other headings)
- The counts as label-value pairs (same style as Quick Stats)
- If a count is 0, show it in the `--text-muted` color as "–" to indicate no data yet
- Add a subtle coloured left-border accent per source: StatsBomb = blue, Understat = green, FBRef = amber

### Also update Quick Stats

In the existing Quick Stats widget, add:
- **Full Profiles**: count of players where `archetype IS NOT NULL AND profile_tier = 1` (from `player_profiles`)

Query:
```typescript
const fullResult = await supabaseServer
  .from("player_profiles")
  .select("person_id", { count: "exact", head: true })
  .not("archetype", "is", null)
  .eq("profile_tier", 1);
```

Add this between "Tier 1 Profiles" and "FBRef Linked" in the quick stats list.

## Step 4: Verify and commit

1. Run `npx next build` in `apps/player-editor/` to verify no TypeScript errors
2. Commit with message: `Add external data sources widget to dashboard + reseed 50 profiles`
3. Push to `main`

## Important notes

- Read `CLAUDE.md` for database schema and table relationships
- The `player_intelligence_card` is a VIEW (read-only) — don't write to it
- All external data tables use RLS with `authenticated` read policies
- The dashboard is a server component — queries run server-side via `supabaseServer`
- Keep the existing dashboard widgets intact; only ADD the new data sources widget
- Match the existing design system: `var(--bg-surface)`, `var(--border-subtle)`, `var(--text-muted)`, etc.
