-- 030_fixtures.sql — Upcoming fixture data from football-data.org
-- Supports match previews with scouting intelligence

create table if not exists fixtures (
  id            bigint primary key generated always as identity,
  external_id   integer unique,
  competition   text not null,
  competition_code text,
  matchday      integer,
  status        text default 'SCHEDULED',
  utc_date      timestamptz not null,
  home_club_id  integer references clubs(id),
  away_club_id  integer references clubs(id),
  home_team     text not null,
  away_team     text not null,
  home_score    integer,
  away_score    integer,
  venue         text,
  synced_at     timestamptz default now(),
  created_at    timestamptz default now()
);

create index if not exists idx_fixtures_date on fixtures(utc_date);
create index if not exists idx_fixtures_home on fixtures(home_club_id);
create index if not exists idx_fixtures_away on fixtures(away_club_id);
create index if not exists idx_fixtures_status on fixtures(status);
create index if not exists idx_fixtures_competition on fixtures(competition_code);

-- RLS: allow anonymous read access for the web app
alter table fixtures enable row level security;
create policy "fixtures_anon_read" on fixtures for select using (true);
