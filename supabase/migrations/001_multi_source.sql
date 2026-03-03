-- ═══════════════════════════════════════════════════════════════
-- VERDICT.GAMES — Migration 001: Multi-Source Data Fields
-- Adds columns for CheapShark, Steam enhanced, IGDB, Wikipedia
-- ═══════════════════════════════════════════════════════════════

-- ── Price & Deals ──
ALTER TABLE games ADD COLUMN IF NOT EXISTS price_current   INTEGER;       -- cents (e.g. 2999 = $29.99)
ALTER TABLE games ADD COLUMN IF NOT EXISTS price_currency  TEXT DEFAULT 'USD';
ALTER TABLE games ADD COLUMN IF NOT EXISTS price_lowest    INTEGER;       -- cents — all-time lowest
ALTER TABLE games ADD COLUMN IF NOT EXISTS price_deal_url  TEXT;          -- CheapShark redirect URL
ALTER TABLE games ADD COLUMN IF NOT EXISTS is_free         BOOLEAN DEFAULT false;

-- ── Player Counts (Steam) ──
ALTER TABLE games ADD COLUMN IF NOT EXISTS current_players INTEGER;       -- live player count
ALTER TABLE games ADD COLUMN IF NOT EXISTS peak_players_24h INTEGER;      -- peak in last 24h (if available)

-- ── Media ──
ALTER TABLE games ADD COLUMN IF NOT EXISTS trailer_url     TEXT;          -- YouTube or RAWG clip URL
ALTER TABLE games ADD COLUMN IF NOT EXISTS trailer_thumbnail TEXT;        -- thumbnail image

-- ── IGDB Cross-Reference ──
ALTER TABLE games ADD COLUMN IF NOT EXISTS igdb_id         INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS igdb_url        TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS igdb_rating     REAL;          -- IGDB aggregated rating 0-100
ALTER TABLE games ADD COLUMN IF NOT EXISTS igdb_summary    TEXT;          -- IGDB storyline/summary

-- ── Wikipedia / Extended Description ──
ALTER TABLE games ADD COLUMN IF NOT EXISTS wikipedia_url   TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS wikipedia_excerpt TEXT;        -- short description from Wikipedia

-- ── Additional External Links ──
ALTER TABLE games ADD COLUMN IF NOT EXISTS metacritic_url  TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS website_url     TEXT;          -- official game website
ALTER TABLE games ADD COLUMN IF NOT EXISTS reddit_url      TEXT;

-- ── CheapShark ID mapping ──
ALTER TABLE games ADD COLUMN IF NOT EXISTS cheapshark_id   TEXT;          -- CheapShark internal game ID

-- ── Enrichment Tracking ──
ALTER TABLE games ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ;  -- when multi-source enrichment ran
ALTER TABLE games ADD COLUMN IF NOT EXISTS enrichment_sources TEXT[] DEFAULT '{}'; -- which sources contributed

-- ── Indexes for new columns ──
CREATE INDEX IF NOT EXISTS idx_games_igdb_id ON games (igdb_id) WHERE igdb_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_cheapshark_id ON games (cheapshark_id) WHERE cheapshark_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_current_players ON games (current_players DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_games_is_free ON games (is_free) WHERE is_free = true;
CREATE INDEX IF NOT EXISTS idx_games_last_enriched ON games (last_enriched_at NULLS FIRST);

