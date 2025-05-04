-- Add no_correct_answer column to questions table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'questions'
        AND column_name = 'no_correct_answer'
    ) THEN
        ALTER TABLE questions
        ADD COLUMN no_correct_answer BOOLEAN DEFAULT FALSE;
        
        COMMENT ON COLUMN questions.no_correct_answer IS 'Indicates if this question has no correct answer (opinion question). When true, the correct_answer field contains a placeholder value.';
    END IF;
END $$;
