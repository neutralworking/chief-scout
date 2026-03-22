---
description: Full system health check — DB, build, git, pipeline status
---

Run a comprehensive health check across all Chief Scout systems:

1. **Git**: branch, uncommitted changes, unpushed commits
2. **Build**: run `npx next build` in apps/web, report pass/fail + any errors
3. **DB**: connect to Supabase, count key tables (people, player_profiles, attribute_grades, player_trait_scores)
4. **Pipeline**: check if any pipeline scripts have syntax errors (`python3 -m py_compile pipeline/*.py`)
5. **Env**: verify required env vars exist in `.env.local` and `apps/web/.env.local`

Report as a compact checklist with pass/fail status per item.
