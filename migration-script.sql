-- Step 1: Create the answer_options table
CREATE TABLE IF NOT EXISTS answer_options (
  id UUID PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT FALSE,
  added_by_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  added_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(question_id, text)
);

-- Step 2: Add is_custom field to the existing answers table if it doesn't exist
ALTER TABLE answers ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;

-- Step 3: Populate the answer_options table with existing predefined options from questions
-- This inserts all predefined options from all questions
INSERT INTO answer_options (id, question_id, text, is_custom, created_at)
SELECT 
  gen_random_uuid(), -- Generate a UUID for each option
  q.id, -- question_id
  unnest(q.options), -- text (unnest the options array)
  FALSE, -- is_custom
  NOW() -- created_at
FROM 
  questions q
ON CONFLICT (question_id, text) DO NOTHING;

-- Step 4: Populate the answer_options table with existing custom answers
INSERT INTO answer_options (id, question_id, text, is_custom, added_by_id, added_by_name, created_at)
SELECT 
  id, -- Use the existing ID
  question_id,
  text,
  TRUE, -- is_custom
  added_by_id,
  added_by_name,
  created_at
FROM 
  custom_answers
ON CONFLICT (question_id, text) DO NOTHING;

-- Note: We're not adding answer_option_id to the answers table yet
-- or migrating existing answers to use it, to maintain compatibility
