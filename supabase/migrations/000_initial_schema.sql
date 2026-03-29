CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  favorite_genres TEXT[] NOT NULL DEFAULT '{}',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles (username);

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  cover_image TEXT NOT NULL DEFAULT '',
  header_image TEXT NOT NULL DEFAULT '',
  screenshots TEXT[] NOT NULL DEFAULT '{}',
  platforms TEXT[] NOT NULL DEFAULT '{}',
  genres TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  developer TEXT NOT NULL DEFAULT '',
  publisher TEXT NOT NULL DEFAULT '',
  release_date DATE,
  description TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  verdict_label TEXT NOT NULL DEFAULT 'MIXED',
  verdict_summary TEXT NOT NULL DEFAULT '',
  pros TEXT[] NOT NULL DEFAULT '{}',
  cons TEXT[] NOT NULL DEFAULT '{}',
  monetization TEXT NOT NULL DEFAULT 'Free',
  performance_notes TEXT NOT NULL DEFAULT '',
  monetization_notes TEXT NOT NULL DEFAULT '',
  steam_url TEXT,
  play_store_url TEXT,
  review_count INTEGER NOT NULL DEFAULT 0,
  user_score INTEGER,
  featured BOOLEAN NOT NULL DEFAULT false,
  trending BOOLEAN NOT NULL DEFAULT false,
  rawg_id INTEGER,
  steam_app_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_games_slug ON games (slug);
CREATE INDEX IF NOT EXISTS idx_games_score ON games (score DESC);
CREATE INDEX IF NOT EXISTS idx_games_trending ON games (trending) WHERE trending = true;
CREATE INDEX IF NOT EXISTS idx_games_featured ON games (featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_games_release_date ON games (release_date DESC);
CREATE INDEX IF NOT EXISTS idx_games_rawg_id ON games (rawg_id) WHERE rawg_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_steam_app_id ON games (steam_app_id) WHERE steam_app_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS game_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_game_id TEXT NOT NULL,
  source_url TEXT,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_sources_unique ON game_sources (source_name, source_game_id);
CREATE INDEX IF NOT EXISTS idx_game_sources_game_id ON game_sources (game_id);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 100),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  pros TEXT[] NOT NULL DEFAULT '{}',
  cons TEXT[] NOT NULL DEFAULT '{}',
  platform TEXT NOT NULL DEFAULT 'PC',
  helpful INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_game_id ON reviews (game_id);
CREATE INDEX IF NOT EXISTS idx_reviews_profile_id ON reviews (profile_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_helpful ON reviews (helpful DESC);

CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_image TEXT NOT NULL DEFAULT '',
  curated_by TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lists_slug ON lists (slug);

CREATE TABLE IF NOT EXISTS list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON list_items (list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_game_id ON list_items (game_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_list_items_unique ON list_items (list_id, game_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_games_updated_at ON games;
CREATE TRIGGER set_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_reviews_updated_at ON reviews;
CREATE TRIGGER set_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_lists_updated_at ON lists;
CREATE TRIGGER set_lists_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read games" ON games;
CREATE POLICY "Public read games" ON games FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read profiles" ON profiles;
CREATE POLICY "Public read profiles" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read reviews" ON reviews;
CREATE POLICY "Public read reviews" ON reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read lists" ON lists;
CREATE POLICY "Public read lists" ON lists FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read list_items" ON list_items;
CREATE POLICY "Public read list_items" ON list_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read game_sources" ON game_sources;
CREATE POLICY "Public read game_sources" ON game_sources FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service insert games" ON games;
CREATE POLICY "Service insert games" ON games FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service update games" ON games;
CREATE POLICY "Service update games" ON games FOR UPDATE TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service delete games" ON games;
CREATE POLICY "Service delete games" ON games FOR DELETE TO service_role USING (true);

DROP POLICY IF EXISTS "Service insert game_sources" ON game_sources;
CREATE POLICY "Service insert game_sources" ON game_sources FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service update game_sources" ON game_sources;
CREATE POLICY "Service update game_sources" ON game_sources FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service insert reviews" ON reviews;
CREATE POLICY "Service insert reviews" ON reviews FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service update reviews" ON reviews;
CREATE POLICY "Service update reviews" ON reviews FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service insert profiles" ON profiles;
CREATE POLICY "Service insert profiles" ON profiles FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service update profiles" ON profiles;
CREATE POLICY "Service update profiles" ON profiles FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service insert lists" ON lists;
CREATE POLICY "Service insert lists" ON lists FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service update lists" ON lists;
CREATE POLICY "Service update lists" ON lists FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service insert list_items" ON list_items;
CREATE POLICY "Service insert list_items" ON list_items FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service delete list_items" ON list_items;
CREATE POLICY "Service delete list_items" ON list_items FOR DELETE TO service_role USING (true);
