-- Add is_opinion_question column to questions table
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS is_opinion_question BOOLEAN DEFAULT FALSE;

-- Update existing questions with no_correct_answer=true to be opinion questions
UPDATE questions
SET is_opinion_question = TRUE
WHERE no_correct_answer = TRUE;
