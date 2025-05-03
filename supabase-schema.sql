-- Create tables for the baby shower trivia game

-- Questions table
CREATE TABLE questions (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('baby-picture', 'text')),
  question TEXT NOT NULL,
  image_url TEXT,
  options TEXT[] NOT NULL,
  correct_answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Participants table
CREATE TABLE participants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Answers table
CREATE TABLE answers (
  id UUID PRIMARY KEY,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, question_id)
);

-- Game state table
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  current_question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'active', 'results')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create storage bucket for baby pictures
-- Note: This needs to be done in the Supabase dashboard or using the Supabase CLI
