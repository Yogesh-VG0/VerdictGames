-- ═══════════════════════════════════════════════════
-- Migration 013: RLS for mobile_store_listings
-- Ensures the table has proper row-level security
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS mobile_store_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  store text NOT NULL CHECK (store IN ('google_play', 'app_store')),
  external_id text NOT NULL,
  store_url text,
  title text NOT NULL DEFAULT '',
  developer text,
  icon_url text,
  header_image_url text,
  screenshots text[] NOT NULL DEFAULT '{}',
  rating_average real,
  rating_count integer NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  installs text,
  real_installs integer,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  is_free boolean NOT NULL DEFAULT true,
  offers_iap boolean NOT NULL DEFAULT false,
  iap_range text,
  genre text,
  genre_id text,
  content_rating text,
  version text,
  released_at text,
  last_updated_at text,
  is_verified boolean NOT NULL DEFAULT false,
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mobile_store_listings_store_external_id
  ON mobile_store_listings (store, external_id);

CREATE INDEX IF NOT EXISTS idx_mobile_store_listings_game_id
  ON mobile_store_listings (game_id);

CREATE INDEX IF NOT EXISTS idx_mobile_store_listings_verified_store
  ON mobile_store_listings (store, is_verified)
  WHERE is_verified = true;

DROP TRIGGER IF EXISTS set_mobile_store_listings_updated_at ON mobile_store_listings;
CREATE TRIGGER set_mobile_store_listings_updated_at
  BEFORE UPDATE ON mobile_store_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE IF EXISTS mobile_store_listings ENABLE ROW LEVEL SECURITY;

-- Public read access (store listings are public data)
DROP POLICY IF EXISTS "Public read mobile_store_listings" ON mobile_store_listings;
CREATE POLICY "Public read mobile_store_listings"
  ON mobile_store_listings FOR SELECT USING (true);

-- Only service_role can write (backfill scripts + ingest pipeline)
DROP POLICY IF EXISTS "Service manage mobile_store_listings" ON mobile_store_listings;
CREATE POLICY "Service manage mobile_store_listings"
  ON mobile_store_listings FOR ALL TO service_role USING (true) WITH CHECK (true);
