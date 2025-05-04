-- Function to check if a column exists in a table
CREATE OR REPLACE FUNCTION check_column_exists(table_name text, column_name text)
RETURNS TABLE(exists boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = $1
    AND column_name = $2
  );
END;
$$ LANGUAGE plpgsql;
