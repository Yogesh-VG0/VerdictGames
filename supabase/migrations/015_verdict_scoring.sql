-- ═══════════════════════════════════════════════════════════════
-- VERDICT.GAMES — Migration 015: Verdict Scoring v2
-- Adds multi-signal scoring columns to replace the single-source
-- waterfall score. Existing `score` column is preserved for
-- backward compatibility.
-- ═══════════════════════════════════════════════════════════════

-- ── Raw Steam review counts (needed for Wilson Lower Bound) ──
ALTER TABLE games ADD COLUMN IF NOT EXISTS steam_positive_count INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS steam_total_count INTEGER;

-- ── Computed scoring signals ──
ALTER TABLE games ADD COLUMN IF NOT EXISTS community_score REAL;       -- Wilson LB * 100, 0-100
ALTER TABLE games ADD COLUMN IF NOT EXISTS critic_score REAL;          -- normalized avg of IGDB + Metacritic, 0-100
ALTER TABLE games ADD COLUMN IF NOT EXISTS critic_source_count INTEGER DEFAULT 0;  -- how many critic sources contributed
ALTER TABLE games ADD COLUMN IF NOT EXISTS confidence REAL DEFAULT 0;  -- 0.0-1.0, trust in the verdict
ALTER TABLE games ADD COLUMN IF NOT EXISTS verdict_score REAL;         -- final blended score, 0-100

-- ── Indexes for the new scoring columns ──
CREATE INDEX IF NOT EXISTS idx_games_verdict_score ON games (verdict_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_games_confidence ON games (confidence DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_games_community_score ON games (community_score DESC NULLS LAST);

-- ── Composite index for top-rated queries (verdict_score + confidence) ──
CREATE INDEX IF NOT EXISTS idx_games_verdict_confidence
  ON games (verdict_score DESC NULLS LAST, confidence DESC NULLS LAST)
  WHERE verdict_score IS NOT NULL;
