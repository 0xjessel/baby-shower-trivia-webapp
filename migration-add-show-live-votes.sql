-- Add a per-game toggle for showing the live vote visualization to guests
-- (the real-time progress bars + vote counts behind each answer option).
-- Defaults to true to preserve existing behavior; set false per game to hide it.
ALTER TABLE games ADD COLUMN IF NOT EXISTS show_live_votes BOOLEAN DEFAULT true;
