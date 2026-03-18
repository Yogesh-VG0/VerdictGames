-- ═══════════════════════════════════════════════════════════════
-- VERDICT.GAMES — Migration 007: Lock TTL via refresh_started_at
-- Cleaner separation: lock expiry based on refresh start, not updated_at
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE games ADD COLUMN IF NOT EXISTS refresh_started_at TIMESTAMPTZ;
