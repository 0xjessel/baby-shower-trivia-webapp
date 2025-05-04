-- Add game_id column to questions table as TEXT to match the games table's id column
ALTER TABLE questions ADD COLUMN IF NOT EXISTS game_id TEXT REFERENCES games(id) ON DELETE CASCADE;

-- Add is_active column to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Add name and description columns to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Unnamed Game';
ALTER TABLE games ADD COLUMN IF NOT EXISTS description TEXT;

-- Update the "current" game to have a name
UPDATE games SET name = 'Default Game', is_active = true WHERE id = 'current';

-- Set game_id for existing questions to the "current" game
UPDATE questions SET game_id = 'current' WHERE game_id IS NULL;

-- Make game_id non-nullable after migration
ALTER TABLE questions ALTER COLUMN game_id SET NOT NULL;
