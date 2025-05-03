-- Add allows_custom_answers column to questions table with default value of true
ALTER TABLE questions ADD COLUMN IF NOT EXISTS allows_custom_answers BOOLEAN DEFAULT true;
