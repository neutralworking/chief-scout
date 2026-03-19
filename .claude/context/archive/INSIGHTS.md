# Insights & Lessons Learned

## Debugging
- 2026-03-15: Arsenal wikidata → was matching "Lesotho Defence Force FC" not Arsenal FC → root cause: ambiguous Wikidata label matching → lesson: always verify wikidata_id maps to expected entity
- 2026-03-15: Club dedup found 28 duplicates → accent variants + inconsistent source naming → lesson: normalize names before insert (strip accents, lowercase compare)
- 2026-03-16: Gaffer crash → localStorage UUID not being set before first vote → lesson: always initialize client-side IDs in useEffect, not on render
- 2026-03-16: News HTML entity decoding → Football Italia uses smart quotes/em dashes → lesson: decode HTML entities server-side before storing
- 2026-03-16: CS Value formula inflation → compound scores being double-counted → lesson: check formula composition when multiple scoring systems interact
- 2026-03-17: FBRef scraper dead → IP blocked → lesson: never rely on single scraping source, always have CSV fallback + API alternatives

## Patterns
- **Multi-source grading**: attribute_grades table uses `source` column to tag origin (scout/fbref/statsbomb/computed). Frontend uses SOURCE_PRIORITY chain to pick best available. New sources just need a pipeline script + priority entry.
- **Pipeline dry-run**: Every pipeline script supports `--dry-run` for preview. Always dry-run first, especially for destructive operations.
- **Role-based commands**: Slash commands give Claude domain expertise without loading full docs. Use `/scout` for player work, `/pipeline` for data work, `/supabase` for DB work.
- **Personality centralization**: All personality type definitions live in `lib/personality.ts`. Never hardcode names/colors elsewhere.

## Gotchas
- `players` is a VIEW (backward compat) — never write to it. Write to `people`, `player_profiles`, `player_status`, `player_market` directly.
- Old Supabase project ref `njulrlyfiamklxptvlun` has compromised keys in git history — always use `fnvlemkbhohyouhjebwf`.
- Pipeline scripts 31-37 have duplicate numbers — check the actual filename, not just the number prefix.
- CSS accent variables use `--color-accent-*` prefix (not `--accent-*`).
