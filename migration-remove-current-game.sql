-- Create a function to migrate from the "current" game to the active game system
CREATE OR REPLACE FUNCTION migrate_to_active_game_system(p_active_game_id UUID)
RETURNS void AS $$
DECLARE
    v_current_question_id UUID;
    v_show_results BOOLEAN;
BEGIN
    -- Get the current game state
    SELECT current_question_id, show_results 
    INTO v_current_question_id, v_show_results
    FROM game_state 
    WHERE id = '00000000-0000-0000-0000-000000000000';
    
    -- Update all questions without a game_id to use the active game
    UPDATE questions
    SET game_id = p_active_game_id
    WHERE game_id IS NULL;
    
    -- Update the active game state to match the current game state
    UPDATE game_state
    SET current_question_id = v_current_question_id,
        show_results = v_show_results
    WHERE id = p_active_game_id;
    
    -- Update all votes to associate with the active game if they don't have a game_id
    UPDATE votes
    SET game_id = p_active_game_id
    WHERE game_id IS NULL;
    
    -- Update all custom answers to associate with the active game if they don't have a game_id
    UPDATE custom_answers
    SET game_id = p_active_game_id
    WHERE game_id IS NULL;
    
    -- Delete the special "current" game state
    DELETE FROM game_state
    WHERE id = '00000000-0000-0000-0000-000000000000';
    
    -- Add a migration record for tracking
    INSERT INTO migration_history (description, migrated_at)
    VALUES ('Migrated from current game to active game system', NOW());
END;
$$ LANGUAGE plpgsql;

-- Create migration_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    migrated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
