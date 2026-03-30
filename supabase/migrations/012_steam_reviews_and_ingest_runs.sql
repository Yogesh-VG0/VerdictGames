-- ═══════════════════════════════════════════════════
-- Steam Player Reviews — imported from official Steam API
-- Separate from native Verdict community reviews
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS steam_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  steam_app_id INTEGER NOT NULL,
  recommendation_id TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'english',
  voted_up BOOLEAN NOT NULL,
  review_text TEXT NOT NULL,
  playtime_at_review INTEGER DEFAULT 0,
  playtime_forever INTEGER DEFAULT 0,
  author_steam_id TEXT,
  author_playtime_forever INTEGER DEFAULT 0,
  authored_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  votes_up INTEGER DEFAULT 0,
  votes_funny INTEGER DEFAULT 0,
  weighted_vote_score REAL DEFAULT 0,
  steam_purchase BOOLEAN DEFAULT true,
  received_for_free BOOLEAN DEFAULT false,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, recommendation_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'steam_reviews_game_id_recommendation_id_key'
      AND conrelid = 'steam_reviews'::regclass
  ) THEN
    ALTER TABLE steam_reviews
      ADD CONSTRAINT steam_reviews_game_id_recommendation_id_key UNIQUE (game_id, recommendation_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_steam_reviews_game_id ON steam_reviews(game_id);
CREATE INDEX IF NOT EXISTS idx_steam_reviews_steam_app_id ON steam_reviews(steam_app_id);
CREATE INDEX IF NOT EXISTS idx_steam_reviews_weighted ON steam_reviews(game_id, weighted_vote_score DESC);

ALTER TABLE steam_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Steam reviews are publicly readable" ON steam_reviews;
CREATE POLICY "Steam reviews are publicly readable"
  ON steam_reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role can manage steam reviews" ON steam_reviews;
CREATE POLICY "Service role can manage steam reviews"
  ON steam_reviews FOR ALL USING (
    (current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role'
  );

-- ═══════════════════════════════════════════════════
-- Ingest Runs — tracks pipeline execution history
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ingest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  games_processed INTEGER DEFAULT 0,
  games_created INTEGER DEFAULT 0,
  games_updated INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  error_details JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ingest_runs_type ON ingest_runs(run_type, started_at DESC);

ALTER TABLE ingest_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ingest runs are publicly readable" ON ingest_runs;
CREATE POLICY "Ingest runs are publicly readable"
  ON ingest_runs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role can manage ingest runs" ON ingest_runs;
CREATE POLICY "Service role can manage ingest runs"
  ON ingest_runs FOR ALL USING (
    (current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role'
  );
