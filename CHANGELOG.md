# Chief Scout — Changelog

All notable changes to this project are documented here.

---

## [2026-03-12] Staging / Production Separation

**Scope**: Medium (6 files)

### Added
- `apps/player-editor/src/lib/env.ts` — Environment detection (`NEXT_PUBLIC_APP_ENV`: staging | production)
- `pipeline/40_promote_to_prod.py` — Promotion script: syncs only Tier 1 players with complete data (all 6 tables + 20+ attribute grades) to production Supabase
- `.env.example` — Added `NEXT_PUBLIC_APP_ENV` variable

### Changed
- `middleware.ts` — Blocks `/admin`, `/editor`, `/scout-pad`, `/squad` in production (redirects to `/`)
- `Sidebar.tsx` — Hides Editor + Admin nav items when `NEXT_PUBLIC_APP_ENV=production`
- `CLAUDE.md` — Documented staging/prod setup, data promotion rules, environment variables

### Architecture Decision
- **Two Vercel projects**: staging (all tools) vs production (platform + marketing only)
- **Two Supabase projects**: staging (working data) vs production (clean, Tier 1 only)
- **One-way promotion**: staging → prod via `40_promote_to_prod.py` (never automatic)
- **Production-ready definition**: Tier 1 profile with archetype + personality + market + status + 20+ attribute grades

### Next Steps
- Create production Supabase project + run migrations
- Create production Vercel project with `NEXT_PUBLIC_APP_ENV=production`
- Add `PROD_SUPABASE_URL` + `PROD_SUPABASE_SERVICE_KEY` to root `.env.local`
- Run first promotion: `python pipeline/40_promote_to_prod.py`
