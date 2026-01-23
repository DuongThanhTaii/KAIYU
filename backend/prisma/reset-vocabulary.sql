-- Reset Vocabulary Data Script
-- Run this to clear all vocabulary-related data for fresh start

-- Step 1: Clear UserVocabulary (user's "borrowed books")
DELETE FROM user_vocabulary;

-- Step 2: Clear FlashcardReviews
DELETE FROM flashcard_reviews;

-- Step 3: Clear VideoVocabulary links
DELETE FROM video_vocabulary;

-- Step 4: Clear SubtitleTokens vocabulary links
UPDATE subtitle_tokens SET vocabulary_id = NULL;

-- Step 5: Clear VocabularyEmbeddings
DELETE FROM vocabulary_embeddings;

-- Step 6: Finally, clear the main Vocabulary table ("library")
DELETE FROM vocabulary;

-- Verify
SELECT COUNT(*) as remaining_vocabulary FROM vocabulary;
SELECT COUNT(*) as remaining_user_vocabulary FROM user_vocabulary;
