---
description: Quick DB stats — player counts, grade coverage, archetype distribution
---

Run a fast database health check against the Chief Scout Supabase staging DB. Show:

1. Total people (active), Tier 1 profiles, Tier 2, Tier 3
2. Attribute grades count + unique players with grades
3. Earned archetypes count + top 5 archetypes by frequency
4. Players missing: personality, market data, blueprint
5. Most recently updated players (last 5)

Use the Supabase client or SQL. Keep output compact — one table per section, no verbose explanations.
