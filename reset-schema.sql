-- Drop existing tables (in reverse order of dependencies)
DROP TABLE IF EXISTS answers;
DROP TABLE IF EXISTS custom_answers;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS participants;
DROP TABLE IF EXISTS questions;

-- Create tables with the new schema
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

-- Answer options table (stores all possible answers - both predefined and custom)
CREATE TABLE answer_options (
  id UUID PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT FALSE,
  added_by_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  added_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(question_id, text)
);

-- Answers table (participant selections)
CREATE TABLE answers (
  id UUID PRIMARY KEY,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_option_id UUID NOT NULL REFERENCES answer_options(id) ON DELETE CASCADE,
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

-- Insert initial game state
INSERT INTO games (id, status) VALUES ('current', 'waiting');
