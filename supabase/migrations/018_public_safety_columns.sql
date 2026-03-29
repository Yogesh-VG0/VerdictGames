-- Migration 018: Public Safety Columns
-- Adds is_adult flag for NSFW content and media_source for image provenance tracking

-- Add is_adult flag to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS is_adult boolean DEFAULT false;

-- Add media_source to track image provenance (steam, igdb, rawg, etc.)
ALTER TABLE games ADD COLUMN IF NOT EXISTS media_source text;

-- Add index for filtering out adult content
CREATE INDEX IF NOT EXISTS idx_games_is_adult ON games (is_adult) WHERE is_adult = true;

-- Add comment for documentation
COMMENT ON COLUMN games.is_adult IS 'True if game contains adult/NSFW content and should be excluded from public surfaces';
COMMENT ON COLUMN games.media_source IS 'Source of cover_image: steam, igdb, rawg, or null if unknown';
