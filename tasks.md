# Tasks — Cross-Environment

Tasks that need to be completed outside the current dev session (e.g. Supabase dashboard, Vercel, local with credentials, etc.).

---

## Pending

### Fixture Previews Setup
- [ ] **Run migration** `pipeline/sql/030_fixtures.sql` in Supabase SQL editor (staging project `fnvlemkbhohyouhjebwf`)
- [ ] **Add API key**: Register at [football-data.org](https://www.football-data.org/client/register), add `FOOTBALL_DATA_API_KEY=xxx` to root `.env.local` and Vercel staging env vars
- [ ] **Ingest fixtures**: Run `python pipeline/31_fixture_ingest.py --competition PL` locally (requires `.env.local` credentials)
- [ ] **Add nav link**: "Fixtures" entry in Sidebar once pages are verified working

---

## Completed

_(Move tasks here when done)_
