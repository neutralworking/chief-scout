-- 017_recalibrate_levels.sql — Recalibrate player level ratings (DOF assessment)
-- Run in Supabase SQL Editor (Dashboard -> SQL Editor).
--
-- Scale reference (0-100):
--   97-99 Generational | 94-96 Ballon d'Or | 90-93 World Class
--   85-89 Elite | 80-84 Top | 75-79 Established
--   70-74 Solid | 65-69 Developing | 60-64 Prospect | <60 Project

UPDATE player_profiles pp
SET level = v.new_level
FROM (VALUES
  -- name is for reference only; update keyed on person_id
  ((SELECT id FROM people WHERE name = 'Kevin De Bruyne'),       86),
  ((SELECT id FROM people WHERE name = 'Alisson Becker'),        88),
  ((SELECT id FROM people WHERE name = 'Lamine Yamal'),          91),
  ((SELECT id FROM people WHERE name = 'Casemiro'),              84),
  ((SELECT id FROM people WHERE name = 'Rodri'),                 88),
  ((SELECT id FROM people WHERE name = 'Achraf Hakimi'),         90),
  ((SELECT id FROM people WHERE name = 'Jordan Pickford'),       88),
  ((SELECT id FROM people WHERE name = 'Victor Osimhen'),        87),
  ((SELECT id FROM people WHERE name = 'Jørgen Strand Larsen'),  84),
  ((SELECT id FROM people WHERE name = 'Ousmane Dembélé'),       92),
  ((SELECT id FROM people WHERE name = 'Maghnes Akliouche'),     85),
  ((SELECT id FROM people WHERE name = 'Nico Paz'),              85),
  ((SELECT id FROM people WHERE name = 'Randal Kolo Muani'),     82),
  ((SELECT id FROM people WHERE name = 'Jaidon Anthony'),        83),
  ((SELECT id FROM people WHERE name = 'Zion Suzuki'),           83),
  ((SELECT id FROM people WHERE name = 'Pau Cubarsí'),           84),
  ((SELECT id FROM people WHERE name = 'João Neves'),            88),
  ((SELECT id FROM people WHERE name = 'Declan Rice'),           90),
  ((SELECT id FROM people WHERE name = 'Carlos Baleba'),         83),
  ((SELECT id FROM people WHERE name = 'Davis Keillor-Dunn'),    74),
  ((SELECT id FROM people WHERE name = 'Kenan Yıldız'),          86),
  ((SELECT id FROM people WHERE name = 'Riccardo Calafiori'),    85),
  ((SELECT id FROM people WHERE name = 'Ben Chilwell'),          79),
  ((SELECT id FROM people WHERE name = 'William Saliba'),        88),
  ((SELECT id FROM people WHERE name = 'Ronald Araujo'),         85),
  ((SELECT id FROM people WHERE name = 'Alessandro Bastoni'),    87),
  ((SELECT id FROM people WHERE name = 'Josko Gvardiol'),        86),
  ((SELECT id FROM people WHERE name = 'Jarrad Branthwaite'),    81),
  ((SELECT id FROM people WHERE name = 'Alphonso Davies'),       86),
  ((SELECT id FROM people WHERE name = 'Theo Hernandez'),        84),
  ((SELECT id FROM people WHERE name = 'Nuno Mendes'),           89),
  ((SELECT id FROM people WHERE name = 'Trent Alexander-Arnold'),88),
  ((SELECT id FROM people WHERE name = 'Pedro Porro'),           84),
  ((SELECT id FROM people WHERE name = 'Aurélien Tchouameni'),   86),
  ((SELECT id FROM people WHERE name = 'Martín Zubimendi'),      87),
  ((SELECT id FROM people WHERE name = 'Jude Bellingham'),       89),
  ((SELECT id FROM people WHERE name = 'Pedri'),                 89),
  ((SELECT id FROM people WHERE name = 'Moisés Caicedo'),        87),
  ((SELECT id FROM people WHERE name = 'Vitinha'),               90),
  ((SELECT id FROM people WHERE name = 'Jamal Musiala'),         89),
  ((SELECT id FROM people WHERE name = 'Bukayo Saka'),           88),
  ((SELECT id FROM people WHERE name = 'Erling Haaland'),        91),
  ((SELECT id FROM people WHERE name = 'Viktor Gyökeres'),       85),
  ((SELECT id FROM people WHERE name = 'Alexander Isak'),        87),
  ((SELECT id FROM people WHERE name = 'Gianluigi Donnarumma'),  90),
  ((SELECT id FROM people WHERE name = 'Kylian Mbappé'),         93),
  ((SELECT id FROM people WHERE name = 'Vinícius Júnior'),       90),
  ((SELECT id FROM people WHERE name = 'Raphinha'),              89),
  ((SELECT id FROM people WHERE name = 'Bernardo Silva'),        87),
  ((SELECT id FROM people WHERE name = 'Phil Foden'),            87)
) AS v(person_id, new_level)
WHERE pp.person_id = v.person_id;
