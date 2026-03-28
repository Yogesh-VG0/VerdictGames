-- Migration: Add media provenance tracking columns
-- Purpose: Track where cover/header images came from for repair auditing

-- Add media_source column to track image provenance
ALTER TABLE games ADD COLUMN IF NOT EXISTS media_source text;

-- Add completeness_score for admin filtering
-- 0-100 score based on: cover_image, header_image, screenshots, description, genres, platforms
ALTER TABLE games ADD COLUMN IF NOT EXISTS completeness_score integer DEFAULT 0;

-- Comment for documentation
COMMENT ON COLUMN games.media_source IS 'Source of cover/header images: steam, igdb, rawg, manual, etc.';
COMMENT ON COLUMN games.completeness_score IS 'Data completeness score 0-100 for admin filtering';

-- Index for admin queries filtering by completeness
CREATE INDEX IF NOT EXISTS idx_games_completeness_score ON games(completeness_score);

-- Backfill media_source based on URL patterns
UPDATE games SET media_source = 
  CASE 
    WHEN cover_image LIKE '%steamstatic.com%' THEN 'steam'
    WHEN cover_image LIKE '%igdb.com%' THEN 'igdb'
    WHEN cover_image LIKE '%rawg.io%' THEN 'rawg'
    WHEN cover_image LIKE '%alphacoders.com%' THEN 'alphacoders'
    WHEN cover_image LIKE '%wallpapercave.com%' THEN 'wallpapercave'
    WHEN cover_image IS NOT NULL AND cover_image != '' THEN 'other'
    ELSE NULL
  END
WHERE media_source IS NULL;

-- Backfill completeness_score
UPDATE games SET completeness_score = (
  -- Cover image: 25 points
  (CASE WHEN cover_image IS NOT NULL AND cover_image != '' THEN 25 ELSE 0 END) +
  -- Header image: 15 points
  (CASE WHEN header_image IS NOT NULL AND header_image != '' THEN 15 ELSE 0 END) +
  -- Screenshots: 15 points (at least 2)
  (CASE WHEN array_length(screenshots, 1) >= 2 THEN 15 WHEN array_length(screenshots, 1) >= 1 THEN 8 ELSE 0 END) +
  -- Description: 20 points (at least 100 chars)
  (CASE WHEN length(description) >= 100 THEN 20 WHEN length(description) >= 20 THEN 10 ELSE 0 END) +
  -- Genres: 10 points
  (CASE WHEN array_length(genres, 1) >= 1 THEN 10 ELSE 0 END) +
  -- Platforms: 10 points
  (CASE WHEN array_length(platforms, 1) >= 1 THEN 10 ELSE 0 END) +
  -- Score present: 5 points
  (CASE WHEN score > 0 THEN 5 ELSE 0 END)
);
