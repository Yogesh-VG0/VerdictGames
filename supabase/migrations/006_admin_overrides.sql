-- Migration 006: Admin manual override fields
-- Allows admins to pin games as featured/trending and override algorithmic score

ALTER TABLE games ADD COLUMN IF NOT EXISTS is_featured_manual BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE games ADD COLUMN IF NOT EXISTS is_trending_manual BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE games ADD COLUMN IF NOT EXISTS manual_score INTEGER DEFAULT NULL;

-- Partial index so manual overrides are fast to query
CREATE INDEX IF NOT EXISTS idx_games_manual_featured ON games(is_featured_manual) WHERE is_featured_manual = true;
CREATE INDEX IF NOT EXISTS idx_games_manual_trending ON games(is_trending_manual) WHERE is_trending_manual = true;
