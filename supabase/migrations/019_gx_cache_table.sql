-- Migration 019: GX Cache Table
-- Durable cache for GX Corner API responses with stale fallback

CREATE TABLE IF NOT EXISTS gx_cache (
  feed_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_gx_cache_fetched_at ON gx_cache (fetched_at);

-- RLS: Only service role can access
ALTER TABLE gx_cache ENABLE ROW LEVEL SECURITY;

-- No public access - service role only
-- Service role bypasses RLS by default

COMMENT ON TABLE gx_cache IS 'Durable cache for GX Corner API responses with stale fallback';
COMMENT ON COLUMN gx_cache.feed_key IS 'Cache key: highlights, calendar, free_to_play, top_games, deals, top_liked, news_popular, news_feed';
COMMENT ON COLUMN gx_cache.payload IS 'Cached JSON response from GX API';
COMMENT ON COLUMN gx_cache.fetched_at IS 'When the data was last successfully fetched from live API';
