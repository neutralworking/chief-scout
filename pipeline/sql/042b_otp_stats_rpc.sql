-- Migration 042b: RPC function to update OTP nation stats after each submission
-- Called by POST /api/on-the-plane/submit

CREATE OR REPLACE FUNCTION update_otp_nation_stats(p_nation_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total      int;
  v_avg        real;
  v_top_player bigint;
  v_top_form   text;
BEGIN
  -- Count entries + average score
  SELECT count(*), avg(score)
    INTO v_total, v_avg
    FROM otp_entries
   WHERE nation_id = p_nation_id
     AND score IS NOT NULL;

  -- Most picked player (appears in most squad_json arrays)
  SELECT (elem->>'person_id')::bigint INTO v_top_player
    FROM otp_entries,
         jsonb_array_elements(squad_json) AS elem
   WHERE nation_id = p_nation_id
   GROUP BY elem->>'person_id'
   ORDER BY count(*) DESC
   LIMIT 1;

  -- Most picked formation
  SELECT formation INTO v_top_form
    FROM otp_entries
   WHERE nation_id = p_nation_id
   GROUP BY formation
   ORDER BY count(*) DESC
   LIMIT 1;

  -- Upsert stats
  INSERT INTO otp_nation_stats (nation_id, total_entries, avg_score, most_picked_player_id, most_picked_formation, updated_at)
  VALUES (p_nation_id, v_total, v_avg, v_top_player, v_top_form, now())
  ON CONFLICT (nation_id)
  DO UPDATE SET
    total_entries         = EXCLUDED.total_entries,
    avg_score             = EXCLUDED.avg_score,
    most_picked_player_id = EXCLUDED.most_picked_player_id,
    most_picked_formation = EXCLUDED.most_picked_formation,
    updated_at            = now();
END;
$$;
