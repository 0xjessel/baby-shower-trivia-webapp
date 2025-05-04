-- Function to get participant rankings based on correct answers
CREATE OR REPLACE FUNCTION get_participant_rankings()
RETURNS TABLE (
  participant_id UUID,
  participant_name TEXT,
  correct_answers BIGINT,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH participant_scores AS (
    SELECT 
      p.id,
      p.name,
      COUNT(a.id) FILTER (WHERE a.is_correct = true) AS correct_answers
    FROM 
      participants p
    LEFT JOIN 
      answers a ON p.id = a.participant_id
    GROUP BY 
      p.id, p.name
  )
  SELECT 
    ps.id,
    ps.name,
    ps.correct_answers,
    RANK() OVER (ORDER BY ps.correct_answers DESC) AS rank
  FROM 
    participant_scores ps
  ORDER BY 
    rank;
END;
$$ LANGUAGE plpgsql;
