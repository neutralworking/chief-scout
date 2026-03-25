-- Migration 043: Tactical role redesign — 36 roles (4 per position, pillar-aligned)
-- Replaces the old 27+6 role set with a clean taxonomy.

-- Add pillar column
ALTER TABLE tactical_roles ADD COLUMN IF NOT EXISTS pillar TEXT;

-- Clear old roles
DELETE FROM tactical_roles;

-- Reset sequence
SELECT setval('tactical_roles_id_seq', 1, false);

-- Seed 36 roles (4 per position × 9 positions)
INSERT INTO tactical_roles (name, position, description, primary_archetype, secondary_archetype, pillar) VALUES
  -- GK
  ('Libero GK',       'GK', 'Distribution specialist — builds attacks from the back',              'GK',         'Passer',     'technical'),
  ('Sweeper Keeper',  'GK', 'High line, sweeps behind defence, reads danger early',                'GK',         'Cover',      'tactical'),
  ('Comandante',      'GK', 'Organizer — commands the area, marshals the backline',                'GK',         'Commander',  'mental'),
  ('Shotstopper',     'GK', 'Reflexes, presence, dominates the six-yard box',                      'GK',         'Target',     'physical'),
  -- CD
  ('Libero',          'CD', 'Ball-playing CB — progressive passing from deep',                     'Passer',     'Cover',      'technical'),
  ('Sweeper',         'CD', 'Last man — reads play two moves ahead, covers space',                 'Cover',      'Controller', 'tactical'),
  ('Zagueiro',        'CD', 'Commanding CB — leads, organizes, sets the defensive tone',           'Commander',  'Destroyer',  'mental'),
  ('Stopper',      'CD', 'Aggressive front-foot defender — wins duels, dominates',              'Powerhouse', 'Destroyer',  'physical'),
  -- WD
  ('Lateral',         'WD', 'Attacking fullback — crosses, final ball, width',                     'Passer',     'Dribbler',   'technical'),
  ('Fluidificante',   'WD', 'Covers full flank in both phases, tireless discipline',               'Engine',     'Cover',      'tactical'),
  ('Invertido',       'WD', 'Inverted FB — reads when to tuck inside, becomes midfielder',         'Controller', 'Passer',     'mental'),
  ('Corredor',        'WD', 'Pace-based fullback — explosive in transition',                       'Sprinter',   'Engine',     'physical'),
  -- DM
  ('Regista',         'DM', 'Deep playmaker — dictates tempo with passing quality',                'Passer',     'Controller', 'technical'),
  ('Sentinelle',      'DM', 'Shield — positions, intercepts, guards the gate',                     'Cover',      'Destroyer',  'tactical'),
  ('Pivote',          'DM', 'Midfield brain — organizes shape, reads everything',                  'Controller', 'Cover',      'mental'),
  ('Volante',         'DM', 'Ball-winner — aggressive, physical, disrupts',                        'Powerhouse', 'Destroyer',  'physical'),
  -- CM
  ('Mezzala',         'CM', 'Half-space creator — technical quality between the lines',            'Passer',     'Creator',    'technical'),
  ('Tuttocampista',   'CM', 'All-pitch midfielder — covers every blade, arrives in box',           'Engine',     'Cover',      'tactical'),
  ('Metodista',       'CM', 'Orchestrator — controls rhythm with intelligent passing',             'Controller', 'Passer',     'mental'),
  ('Relayeur',        'CM', 'Tireless shuttle — pace and power to link phases',                    'Sprinter',   'Engine',     'physical'),
  -- WM
  ('Winger',          'WM', 'Beats defenders with skill and trickery, delivers from wide',         'Dribbler',   'Passer',     'technical'),
  ('Tornante',        'WM', 'Full-flank wide mid — works both phases, selfless',                   'Engine',     'Cover',      'tactical'),
  ('False Winger',    'WM', 'Starts wide, drifts inside intelligently to create overloads',        'Controller', 'Cover',      'mental'),
  ('Shuttler',        'WM', 'Raw pace and stamina to cover the flank end to end',                  'Sprinter',   'Engine',     'physical'),
  -- AM
  ('Trequartista',    'AM', 'Free-roaming 10 — dribbling genius in the final third',              'Dribbler',   'Creator',    'technical'),
  ('Seconda Punta',   'AM', 'Second striker — reads space, links play through movement',           'Engine',     'Striker',    'tactical'),
  ('Enganche',        'AM', 'The hook — sees everything, threads impossible passes',               'Controller', 'Creator',    'mental'),
  ('Boxcrasher',      'AM', 'Dynamic AM who arrives in the box with pace and power',               'Sprinter',   'Striker',    'physical'),
  -- WF
  ('Inside Forward',  'WF', 'Cuts inside on strong foot to shoot or create',                      'Dribbler',   'Sprinter',   'technical'),
  ('Raumdeuter',      'WF', 'Space interpreter — presses and finds pockets to score',              'Engine',     'Striker',    'tactical'),
  ('Inventor',        'WF', 'Creates something from nothing — vision from wide',                   'Creator',    'Dribbler',   'mental'),
  ('Extremo',         'WF', 'Electric pace and power — stretches the defence',                     'Sprinter',   'Striker',    'physical'),
  -- CF
  ('Poacher',         'CF', 'Pure finisher — movement, instinct, clinical in the box',            'Striker',    'Dribbler',   'technical'),
  ('Spearhead',       'CF', 'Leads the press from front, relentless work rate',                    'Engine',     'Destroyer',  'tactical'),
  ('Falso Nove',      'CF', 'False 9 — drops deep, creates, pulls CBs out of shape',             'Creator',    'Controller', 'mental'),
  ('Prima Punta',     'CF', 'Target striker — aerial, holds up, physical reference point',        'Target',     'Powerhouse', 'physical')
ON CONFLICT (name, position) DO UPDATE SET
  description = EXCLUDED.description,
  primary_archetype = EXCLUDED.primary_archetype,
  secondary_archetype = EXCLUDED.secondary_archetype,
  pillar = EXCLUDED.pillar;

-- Clean up old roles that no longer exist
DELETE FROM tactical_roles WHERE name NOT IN (
  'Libero GK', 'Sweeper Keeper', 'Comandante', 'Shotstopper',
  'Libero', 'Sweeper', 'Zagueiro', 'Stopper',
  'Lateral', 'Fluidificante', 'Invertido', 'Corredor',
  'Regista', 'Sentinelle', 'Pivote', 'Volante',
  'Mezzala', 'Tuttocampista', 'Metodista', 'Relayeur',
  'Winger', 'Tornante', 'False Winger', 'Shuttler',
  'Trequartista', 'Seconda Punta', 'Enganche', 'Boxcrasher',
  'Inside Forward', 'Raumdeuter', 'Inventor', 'Extremo',
  'Poacher', 'Spearhead', 'Falso Nove', 'Prima Punta'
);
