-- Add no_correct_answer column to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS no_correct_answer BOOLEAN DEFAULT FALSE;

-- Update existing questions to set no_correct_answer to false
UPDATE questions SET no_correct_answer = FALSE WHERE no_correct_answer IS NULL;

-- Add comment to explain the correct_answer field behavior
COMMENT ON COLUMN questions.correct_answer IS 'For questions with no_correct_answer=true, this field contains a placeholder value';
