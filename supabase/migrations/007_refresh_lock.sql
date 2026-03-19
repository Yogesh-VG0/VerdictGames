-- ═══════════════════════════════════════════════════════════════
-- VERDICT.GAMES — Migration 007: Re-enrichment Safety Lock
-- Prevents duplicate on-demand refresh when multiple users hit stale game
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE games ADD COLUMN IF NOT EXISTS is_refreshing BOOLEAN DEFAULT false;
