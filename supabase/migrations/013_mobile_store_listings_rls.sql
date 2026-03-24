-- ═══════════════════════════════════════════════════
-- Migration 013: RLS for mobile_store_listings
-- Ensures the table has proper row-level security
-- ═══════════════════════════════════════════════════

ALTER TABLE IF EXISTS mobile_store_listings ENABLE ROW LEVEL SECURITY;

-- Public read access (store listings are public data)
CREATE POLICY "Public read mobile_store_listings"
  ON mobile_store_listings FOR SELECT USING (true);

-- Only service_role can write (backfill scripts + ingest pipeline)
CREATE POLICY "Service manage mobile_store_listings"
  ON mobile_store_listings FOR ALL TO service_role USING (true) WITH CHECK (true);
