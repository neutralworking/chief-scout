-- Migration 026: Career history classification
-- Adds team_type to player_career_history to distinguish senior clubs from
-- national teams and youth/reserve teams. Fixes metrics pollution.

-- ── Add classification column ────────────────────────────────────────────────

ALTER TABLE player_career_history
  ADD COLUMN IF NOT EXISTS team_type TEXT
  CHECK (team_type IN ('senior_club', 'national_team', 'youth', 'reserve'));

CREATE INDEX IF NOT EXISTS idx_career_history_team_type
  ON player_career_history(team_type);

-- ── Backfill: classify existing rows based on club_name patterns ─────────────

-- National teams: "X national football team", "X national team", country-only names
UPDATE player_career_history
SET team_type = 'national_team'
WHERE team_type IS NULL
  AND (
    club_name ILIKE '%national%team%'
    OR club_name ILIKE '%national%football%'
    OR club_name ILIKE '% U-__'
    OR club_name ILIKE '% U__'
    OR club_name IN (
      'Argentina', 'Australia', 'Austria', 'Belgium', 'Bolivia', 'Bosnia and Herzegovina',
      'Brazil', 'Bulgaria', 'Cameroon', 'Canada', 'Chile', 'China', 'Colombia',
      'Costa Rica', 'Croatia', 'Czech Republic', 'Denmark', 'Ecuador', 'Egypt',
      'England', 'Estonia', 'Finland', 'France', 'Georgia', 'Germany', 'Ghana',
      'Greece', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran',
      'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan',
      'Jordan', 'Kenya', 'Latvia', 'Lithuania', 'Luxembourg', 'Mali', 'Mexico',
      'Montenegro', 'Morocco', 'Netherlands', 'New Zealand', 'Nigeria', 'North Korea',
      'North Macedonia', 'Northern Ireland', 'Norway', 'Panama', 'Paraguay', 'Peru',
      'Poland', 'Portugal', 'Qatar', 'Republic of Ireland', 'Romania', 'Russia',
      'Saudi Arabia', 'Scotland', 'Senegal', 'Serbia', 'Slovakia', 'Slovenia',
      'South Africa', 'South Korea', 'Spain', 'Sweden', 'Switzerland', 'Tunisia',
      'Turkey', 'Ukraine', 'United States', 'Uruguay', 'Venezuela', 'Vietnam', 'Wales',
      'Algeria', 'Angola', 'Bahrain', 'Benin', 'Burkina Faso', 'Cape Verde',
      'Central African Republic', 'Chad', 'Comoros', 'Congo', 'Cuba',
      'DR Congo', 'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia',
      'Gabon', 'Gambia', 'Guinea', 'Guinea-Bissau', 'Haiti',
      'Kosovo', 'Kuwait', 'Lebanon', 'Libya', 'Madagascar', 'Malawi',
      'Mauritania', 'Mauritius', 'Mozambique', 'Namibia', 'Niger',
      'Oman', 'Palestine', 'Philippines', 'Rwanda', 'Sierra Leone',
      'Somalia', 'Sudan', 'Syria', 'Tanzania', 'Togo', 'Trinidad and Tobago',
      'Uganda', 'United Arab Emirates', 'Uzbekistan', 'Zambia', 'Zimbabwe'
    )
  );

-- Youth/academy teams
UPDATE player_career_history
SET team_type = 'youth'
WHERE team_type IS NULL
  AND (
    club_name ILIKE '%youth%'
    OR club_name ILIKE '%academy%'
    OR club_name ILIKE '%juvenil%'
    OR club_name ILIKE '%U-17%'
    OR club_name ILIKE '%U-18%'
    OR club_name ILIKE '%U-19%'
    OR club_name ILIKE '%U-21%'
    OR club_name ILIKE '%U-23%'
    OR club_name ILIKE '%under-1%'
    OR club_name ILIKE '%under-2%'
    OR club_name ILIKE '%U17%'
    OR club_name ILIKE '%U18%'
    OR club_name ILIKE '%U19%'
    OR club_name ILIKE '%U21%'
    OR club_name ILIKE '%U23%'
    OR club_name ILIKE '%Primavera%'
    OR club_name ILIKE '%Cantera%'
    OR club_name ILIKE '% Juvenil%'
    OR club_name ILIKE '% Youth%'
  );

-- Reserve/B teams
UPDATE player_career_history
SET team_type = 'reserve'
WHERE team_type IS NULL
  AND (
    club_name ILIKE '% B'
    OR club_name ILIKE '% II'
    OR club_name ILIKE '% reserve%'
    OR club_name ILIKE '%Castilla%'
    OR club_name ILIKE '%Atlético Madrid B%'
    OR club_name ILIKE '% B team%'
    OR club_name ILIKE '% II team%'
  );

-- Everything else = senior club
UPDATE player_career_history
SET team_type = 'senior_club'
WHERE team_type IS NULL;
