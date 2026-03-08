-- Add Ballon d'Or category and tags
INSERT INTO tags (name, category) VALUES
  ('Ballon d''Or Contention', 'award_contention'),
  ('Ballon d''Or Top 30 Contention', 'award_contention')
ON CONFLICT (name) DO NOTHING;
