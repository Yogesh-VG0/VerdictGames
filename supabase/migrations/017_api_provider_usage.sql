-- API Provider Usage Tracking
-- Tracks API calls to external providers for budget monitoring and rate limiting

CREATE TABLE IF NOT EXISTS api_provider_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,           -- 'rawg', 'igdb', 'steam', 'gxcorner', 'cheapshark', 'hltb', 'wikipedia', 'googleplay', 'appstore'
  endpoint TEXT NOT NULL,           -- specific endpoint or operation
  request_count INTEGER DEFAULT 1,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  total_latency_ms INTEGER DEFAULT 0,
  hour_bucket TIMESTAMPTZ NOT NULL, -- truncated to hour for aggregation
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for upsert-based aggregation
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_provider_usage_bucket 
  ON api_provider_usage(provider, endpoint, hour_bucket);

-- Index for querying by provider
CREATE INDEX IF NOT EXISTS idx_api_provider_usage_provider 
  ON api_provider_usage(provider, hour_bucket DESC);

-- Index for recent usage queries
CREATE INDEX IF NOT EXISTS idx_api_provider_usage_recent 
  ON api_provider_usage(hour_bucket DESC);

-- Daily usage summary view
CREATE OR REPLACE VIEW api_provider_daily_usage AS
SELECT 
  provider,
  DATE_TRUNC('day', hour_bucket) AS day,
  SUM(request_count) AS total_requests,
  SUM(success_count) AS total_success,
  SUM(error_count) AS total_errors,
  AVG(CASE WHEN success_count > 0 THEN total_latency_ms::float / success_count ELSE 0 END)::INTEGER AS avg_latency_ms
FROM api_provider_usage
GROUP BY provider, DATE_TRUNC('day', hour_bucket)
ORDER BY day DESC, provider;

-- Provider budget limits table (configurable)
CREATE TABLE IF NOT EXISTS api_provider_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT UNIQUE NOT NULL,
  daily_limit INTEGER,              -- max requests per day (null = unlimited)
  hourly_limit INTEGER,             -- max requests per hour (null = unlimited)
  monthly_limit INTEGER,            -- max requests per month (null = unlimited)
  cost_per_request NUMERIC(10,6),   -- cost in USD per request (for tracking)
  is_enabled BOOLEAN DEFAULT true,  -- kill switch
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'api_provider_budgets_provider_key'
      AND conrelid = 'api_provider_budgets'::regclass
  ) THEN
    ALTER TABLE api_provider_budgets
      ADD CONSTRAINT api_provider_budgets_provider_key UNIQUE (provider);
  END IF;
END
$$;

-- Seed default budgets for known providers
INSERT INTO api_provider_budgets (provider, daily_limit, hourly_limit, monthly_limit, cost_per_request, notes)
VALUES 
  ('rawg', 20000, 1000, NULL, 0, 'Free tier: 20k/day'),
  ('igdb', 10000, 500, NULL, 0, 'Twitch auth: 4 requests/sec'),
  ('steam', NULL, 200, NULL, 0, 'No hard limit, be respectful'),
  ('gxcorner', NULL, 100, NULL, 0, 'GX Corner proxy'),
  ('cheapshark', 5000, 300, NULL, 0, 'Free API'),
  ('hltb', 1000, 100, NULL, 0, 'Unofficial scraping'),
  ('wikipedia', 5000, 200, NULL, 0, 'Wikipedia API'),
  ('googleplay', 5000, 200, NULL, 0, 'google-play-scraper'),
  ('appstore', 5000, 200, NULL, 0, 'iTunes API')
ON CONFLICT (provider) DO NOTHING;

-- RLS policies
ALTER TABLE api_provider_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_provider_budgets ENABLE ROW LEVEL SECURITY;

-- Service role has full access
DROP POLICY IF EXISTS "Service role full access to api_provider_usage" ON api_provider_usage;
CREATE POLICY "Service role full access to api_provider_usage"
  ON api_provider_usage FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to api_provider_budgets" ON api_provider_budgets;
CREATE POLICY "Service role full access to api_provider_budgets"
  ON api_provider_budgets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read (for admin dashboard)
DROP POLICY IF EXISTS "Authenticated users can read api_provider_usage" ON api_provider_usage;
CREATE POLICY "Authenticated users can read api_provider_usage"
  ON api_provider_usage FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can read api_provider_budgets" ON api_provider_budgets;
CREATE POLICY "Authenticated users can read api_provider_budgets"
  ON api_provider_budgets FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE api_provider_usage IS 'Hourly aggregated API usage metrics per provider';
COMMENT ON TABLE api_provider_budgets IS 'Configurable budget limits and kill switches per provider';
