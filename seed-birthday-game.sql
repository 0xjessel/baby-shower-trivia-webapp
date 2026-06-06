-- =============================================================================
-- Seed: Jayce's 1st Birthday League Challenge
-- =============================================================================
-- Run this in the Supabase SQL editor (same project as the baby shower game).
-- It creates a NEW game alongside the existing data and sets it active, then
-- inserts 17 text questions for the party.
--
-- NOTES:
--  * Answers marked "[GUESS]" below are made up because the real value wasn't
--    provided. The game still works — edit them later in the admin dashboard
--    (Questions list -> edit). Each question's correct_answer MUST exactly match
--    one entry in its options array.
--  * Opinion questions (look-alike, Global Entry, walking, talking) have
--    no_correct_answer = true, so guests just vote (no points). Their
--    correct_answer column holds the first option as a harmless placeholder,
--    matching how the app stores these (app/actions.ts uploadQuestion).
--  * answer_options are NOT seeded here — the app fills that table at runtime
--    (populateAnswerOptions) the first time each question is shown.
--  * Question order in-game follows created_at ascending, so explicit
--    incrementing timestamps below lock the 1..17 sequence.
-- =============================================================================

-- 1) Make sure only the birthday game ends up active.
UPDATE games SET is_active = false;

-- 2) Create the birthday game (safe to re-run).
INSERT INTO games (id, name, description, status, is_active)
VALUES (
  'jayce-first-bday',
  'Jayce''s 1st Birthday League Challenge',
  'Trivia for Jayce''s 1st birthday — guess how the little traveler spent his first year!',
  'waiting',
  true
)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      is_active = true;

-- 3) Insert the questions. (Re-running appends duplicates; if you need a clean
--    re-seed, first run:  DELETE FROM questions WHERE game_id = 'jayce-first-bday';)
INSERT INTO questions
  (id, type, question, image_url, options, correct_answer, allows_custom_answers, no_correct_answer, game_id, created_at)
VALUES
  -- 1
  (gen_random_uuid(), 'text', 'By the time I was 1 year old today: how many countries have I been to?',
   NULL, ARRAY['4','5','6','7'], '6', true, false, 'jayce-first-bday', '2026-06-06 09:00:01+00'),
  -- 2
  (gen_random_uuid(), 'text', 'Which country was the friendliest to me?',
   NULL, ARRAY['USA','Japan','Morocco','Taiwan'], 'Morocco', true, false, 'jayce-first-bday', '2026-06-06 09:00:02+00'),
  -- 3
  (gen_random_uuid(), 'text', 'How many flights have I been on?',
   NULL, ARRAY['15','19','23','26'], '23', true, false, 'jayce-first-bday', '2026-06-06 09:00:03+00'),
  -- 4 (opinion)
  (gen_random_uuid(), 'text', 'Who do I look like more? Mommy or Daddy?',
   NULL, ARRAY['Mommy','Daddy'], 'Mommy', false, true, 'jayce-first-bday', '2026-06-06 09:00:04+00'),
  -- 5
  (gen_random_uuid(), 'text', 'How old was I when I applied for my passport?',
   NULL, ARRAY['1 month old','2 months old','3 months old','6 months old'], '2 months old', true, false, 'jayce-first-bday', '2026-06-06 09:00:05+00'),
  -- 6 (opinion / made-up options)
  (gen_random_uuid(), 'text', 'What questions did they ask me during my Global Entry interview?',
   NULL, ARRAY['Anything to declare? (Snacks!)','Where were you born?','How many naps a day?','Favorite airport lounge?'], 'Anything to declare? (Snacks!)', true, true, 'jayce-first-bday', '2026-06-06 09:00:06+00'),
  -- 7
  (gen_random_uuid(), 'text', 'Which country did I learn how to crawl?',
   NULL, ARRAY['Spain','Portugal','Korea','China'], 'Korea', true, false, 'jayce-first-bday', '2026-06-06 09:00:07+00'),
  -- 8
  (gen_random_uuid(), 'text', 'Which country did I learn how to share my food?',
   NULL, ARRAY['Spain','Morocco','Taiwan','USA'], 'Taiwan', true, false, 'jayce-first-bday', '2026-06-06 09:00:08+00'),
  -- 9 (made-up options)
  (gen_random_uuid(), 'text', 'Which country did I go to my first aquarium?',
   NULL, ARRAY['Japan','USA','Taiwan','Singapore'], 'Japan', true, false, 'jayce-first-bday', '2026-06-06 09:00:09+00'),
  -- 10 (made-up options)
  (gen_random_uuid(), 'text', 'What has been my favorite food so far?',
   NULL, ARRAY['Avocado','Banana','Sweet potato','Rice'], 'Avocado', true, false, 'jayce-first-bday', '2026-06-06 09:00:10+00'),
  -- 11
  (gen_random_uuid(), 'text', 'What animal have I not ridden on yet?',
   NULL, ARRAY['Camel','Horse','Dog','Yak'], 'Yak', true, false, 'jayce-first-bday', '2026-06-06 09:00:11+00'),
  -- 12 (made-up options)
  (gen_random_uuid(), 'text', 'What''s my favorite toy on trips?',
   NULL, ARRAY['Toy airplane','Stuffed bunny','Teething ring','Books'], 'Toy airplane', true, false, 'jayce-first-bday', '2026-06-06 09:00:12+00'),
  -- 13 (made-up options)
  (gen_random_uuid(), 'text', 'Which uncle has changed my poopy diaper?',
   NULL, ARRAY['Uncle Kevin','Uncle David','Uncle Michael','Uncle Tommy'], 'Uncle Kevin', true, false, 'jayce-first-bday', '2026-06-06 09:00:13+00'),
  -- 14 (opinion)
  (gen_random_uuid(), 'text', 'When will I start walking?',
   NULL, ARRAY['Already walking!','13 months','14 months','15+ months'], 'Already walking!', true, true, 'jayce-first-bday', '2026-06-06 09:00:14+00'),
  -- 15 (opinion)
  (gen_random_uuid(), 'text', 'When will I start talking?',
   NULL, ARRAY['Already talking!','13 months','15 months','18+ months'], 'Already talking!', true, true, 'jayce-first-bday', '2026-06-06 09:00:15+00'),
  -- 16
  (gen_random_uuid(), 'text', 'How many teeth do I have?',
   NULL, ARRAY['3','4','5','6'], '4', true, false, 'jayce-first-bday', '2026-06-06 09:00:16+00'),
  -- 17
  (gen_random_uuid(), 'text', 'Which is the first beach I''ve ever seen in my life?',
   NULL, ARRAY['Jeju','Honolulu','Xiamen','Okinawa'], 'Jeju', true, false, 'jayce-first-bday', '2026-06-06 09:00:17+00');

-- 4) Verify.
-- SELECT id, name, is_active, status FROM games WHERE id = 'jayce-first-bday';
-- SELECT question, options, correct_answer, no_correct_answer
--   FROM questions WHERE game_id = 'jayce-first-bday' ORDER BY created_at;
