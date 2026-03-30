-- 050: Add coach + preferred formation to wc_nations for OTP squad computation
-- The ideal squad algorithm should use the real manager's formation, not brute-force

ALTER TABLE wc_nations ADD COLUMN IF NOT EXISTS coach_name text;
ALTER TABLE wc_nations ADD COLUMN IF NOT EXISTS preferred_formation text;

-- Seed current WC 2026 coaches and their preferred formations
-- Sources: current national team appointments as of March 2026

-- UEFA
UPDATE wc_nations SET coach_name = 'Thomas Tuchel',       preferred_formation = '4-2-3-1' WHERE slug = 'england';
UPDATE wc_nations SET coach_name = 'Didier Deschamps',    preferred_formation = '4-2-3-1' WHERE slug = 'france';
UPDATE wc_nations SET coach_name = 'Luis de la Fuente',   preferred_formation = '4-3-3'   WHERE slug = 'spain';
UPDATE wc_nations SET coach_name = 'Julian Nagelsmann',   preferred_formation = '4-2-3-1' WHERE slug = 'germany';
UPDATE wc_nations SET coach_name = 'Luciano Spalletti',   preferred_formation = '3-5-2'   WHERE slug = 'italy';
UPDATE wc_nations SET coach_name = 'Ronald Koeman',       preferred_formation = '4-3-3'   WHERE slug = 'netherlands';
UPDATE wc_nations SET coach_name = 'Roberto Martínez',    preferred_formation = '4-3-3'   WHERE slug = 'portugal';
UPDATE wc_nations SET coach_name = 'Domenico Tedesco',    preferred_formation = '4-2-3-1' WHERE slug = 'belgium';
UPDATE wc_nations SET coach_name = 'Zlatko Dalić',        preferred_formation = '4-3-3'   WHERE slug = 'croatia';
UPDATE wc_nations SET coach_name = 'Brian Riemer',        preferred_formation = '3-5-2'   WHERE slug = 'denmark';
UPDATE wc_nations SET coach_name = 'Ralf Rangnick',       preferred_formation = '4-2-3-1' WHERE slug = 'austria';
UPDATE wc_nations SET coach_name = 'Murat Yakın',         preferred_formation = '3-4-3'   WHERE slug = 'switzerland';
UPDATE wc_nations SET coach_name = 'Serhiy Rebrov',       preferred_formation = '4-3-3'   WHERE slug = 'ukraine';
UPDATE wc_nations SET coach_name = 'Vincenzo Montella',   preferred_formation = '4-2-3-1' WHERE slug = 'turkey';
UPDATE wc_nations SET coach_name = 'Dragan Stojković',    preferred_formation = '3-5-2'   WHERE slug = 'serbia';
UPDATE wc_nations SET coach_name = 'Michał Probierz',     preferred_formation = '3-5-2'   WHERE slug = 'poland';

-- CONMEBOL
UPDATE wc_nations SET coach_name = 'Lionel Scaloni',      preferred_formation = '4-3-3'   WHERE slug = 'argentina';
UPDATE wc_nations SET coach_name = 'Dorival Júnior',      preferred_formation = '4-3-3'   WHERE slug = 'brazil';
UPDATE wc_nations SET coach_name = 'Marcelo Bielsa',      preferred_formation = '3-4-3'   WHERE slug = 'uruguay';
UPDATE wc_nations SET coach_name = 'Néstor Lorenzo',      preferred_formation = '4-2-3-1' WHERE slug = 'colombia';
UPDATE wc_nations SET coach_name = 'Sebastián Beccacece', preferred_formation = '4-3-3'   WHERE slug = 'ecuador';
UPDATE wc_nations SET coach_name = 'Alfredo Arias',       preferred_formation = '4-4-2'   WHERE slug = 'paraguay';

-- CONCACAF
UPDATE wc_nations SET coach_name = 'Mauricio Pochettino', preferred_formation = '4-3-3'   WHERE slug = 'usa';
UPDATE wc_nations SET coach_name = 'Javier Aguirre',      preferred_formation = '4-3-3'   WHERE slug = 'mexico';
UPDATE wc_nations SET coach_name = 'Jesse Marsch',        preferred_formation = '4-2-3-1' WHERE slug = 'canada';
UPDATE wc_nations SET coach_name = 'Claudio Vivas',       preferred_formation = '4-4-2'   WHERE slug = 'costa-rica';
UPDATE wc_nations SET coach_name = 'Steve McClaren',      preferred_formation = '4-2-3-1' WHERE slug = 'jamaica';
UPDATE wc_nations SET coach_name = 'Thomas Christiansen', preferred_formation = '4-2-3-1' WHERE slug = 'panama';
UPDATE wc_nations SET coach_name = 'Reinaldo Rueda',      preferred_formation = '4-4-2'   WHERE slug = 'honduras';

-- CAF
UPDATE wc_nations SET coach_name = 'Walid Regragui',      preferred_formation = '4-3-3'   WHERE slug = 'morocco';
UPDATE wc_nations SET coach_name = 'Aliou Cissé',         preferred_formation = '4-3-3'   WHERE slug = 'senegal';
UPDATE wc_nations SET coach_name = 'Éric Chelle',         preferred_formation = '4-2-3-1' WHERE slug = 'nigeria';
UPDATE wc_nations SET coach_name = 'Hossam Hassan',       preferred_formation = '4-2-3-1' WHERE slug = 'egypt';
UPDATE wc_nations SET coach_name = 'Marc Brys',           preferred_formation = '4-3-3'   WHERE slug = 'cameroon';
UPDATE wc_nations SET coach_name = 'Emerse Faé',          preferred_formation = '4-3-3'   WHERE slug = 'ivory-coast';
UPDATE wc_nations SET coach_name = 'Vladimir Petković',   preferred_formation = '4-3-3'   WHERE slug = 'algeria';
UPDATE wc_nations SET coach_name = 'Hugo Broos',          preferred_formation = '4-3-3'   WHERE slug = 'south-africa';
UPDATE wc_nations SET coach_name = 'Sébastien Desabre',   preferred_formation = '4-2-3-1' WHERE slug = 'dr-congo';

-- AFC
UPDATE wc_nations SET coach_name = 'Hajime Moriyasu',     preferred_formation = '4-2-3-1' WHERE slug = 'japan';
UPDATE wc_nations SET coach_name = 'Hong Myung-bo',       preferred_formation = '4-3-3'   WHERE slug = 'south-korea';
UPDATE wc_nations SET coach_name = 'Amir Ghalenoei',      preferred_formation = '4-2-3-1' WHERE slug = 'iran';
UPDATE wc_nations SET coach_name = 'Tony Popovic',        preferred_formation = '4-2-3-1' WHERE slug = 'australia';
UPDATE wc_nations SET coach_name = 'Roberto Mancini',     preferred_formation = '4-3-3'   WHERE slug = 'saudi-arabia';
UPDATE wc_nations SET coach_name = 'Luis García',         preferred_formation = '4-3-3'   WHERE slug = 'qatar';
UPDATE wc_nations SET coach_name = 'Jesús Casas',         preferred_formation = '4-3-3'   WHERE slug = 'iraq';
UPDATE wc_nations SET coach_name = 'Shin Tae-yong',       preferred_formation = '4-2-3-1' WHERE slug = 'indonesia';

-- CONMEBOL (playoff)
UPDATE wc_nations SET coach_name = 'Jorge Fossati',       preferred_formation = '3-5-2'   WHERE slug = 'peru';

-- OFC
UPDATE wc_nations SET coach_name = 'Darren Bazeley',      preferred_formation = '4-3-3'   WHERE slug = 'new-zealand';
