-- ═══════════════════════════════════════════════════════════════
-- VERDICT.GAMES — Migration 002: Player Snapshots + Momentum
-- Enables momentum tracking (trending up / falling signals).
-- Run this in Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────── PLAYER SNAPSHOTS ─────────────────────────
-- Stores hourly player count snapshots for momentum calculation.
-- Cron writes at most one row per game per hour.

CREATE TABLE IF NOT EXISTS player_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_count  INTEGER NOT NULL DEFAULT 0,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_snapshots_game_time
  ON player_snapshots (game_id, recorded_at DESC);

-- ───────────────────────── MOMENTUM COLUMN ─────────────────────────
-- Stores the pre-computed momentum value on the games table.
-- Uses log-based formula: ln(current+1) - ln(previous+1)

ALTER TABLE games ADD COLUMN IF NOT EXISTS momentum REAL NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_games_momentum ON games (momentum DESC);

-- ───────────────────────── RLS POLICIES ─────────────────────────

ALTER TABLE player_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read player_snapshots" ON player_snapshots;
CREATE POLICY "Public read player_snapshots" ON player_snapshots
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service insert player_snapshots" ON player_snapshots;
CREATE POLICY "Service insert player_snapshots" ON player_snapshots
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service delete player_snapshots" ON player_snapshots;
CREATE POLICY "Service delete player_snapshots" ON player_snapshots
  FOR DELETE TO service_role USING (true);
