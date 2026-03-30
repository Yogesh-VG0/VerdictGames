-- ═══════════════════════════════════════════════════════════════
-- Migration 004: User Features
-- Auth, Library, Follows, Review Comments, Votes, Wishlists, HLTB
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────── PROFILES: Link to auth.users ─────────────────────────

-- Add auth_id column to profiles to link with Supabase Auth
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_profiles_auth_id ON profiles (auth_id) WHERE auth_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_auth_id_key'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_auth_id_key UNIQUE (auth_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_auth_id_fkey'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- ───────────────────────── USER GAMES (Library / Backlog) ─────────────────────────

CREATE TABLE IF NOT EXISTS user_games (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'wishlist' CHECK (status IN ('wishlist', 'playing', 'completed', 'dropped', 'paused')),
  personal_rating INTEGER CHECK (personal_rating IS NULL OR (personal_rating >= 0 AND personal_rating <= 100)),
  hours_played    NUMERIC(8,1) DEFAULT 0,
  notes           TEXT NOT NULL DEFAULT '',
  started_at      DATE,
  completed_at    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_games_unique ON user_games (user_id, game_id);
CREATE INDEX IF NOT EXISTS idx_user_games_user_id ON user_games (user_id);
CREATE INDEX IF NOT EXISTS idx_user_games_game_id ON user_games (game_id);
CREATE INDEX IF NOT EXISTS idx_user_games_status ON user_games (user_id, status);

DROP TRIGGER IF EXISTS set_user_games_updated_at ON user_games;
CREATE TRIGGER set_user_games_updated_at
  BEFORE UPDATE ON user_games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ───────────────────────── FOLLOWS ─────────────────────────

CREATE TABLE IF NOT EXISTS follows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_unique ON follows (follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows (following_id);

-- ───────────────────────── REVIEW COMMENTS ─────────────────────────

CREATE TABLE IF NOT EXISTS review_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 2000),
  parent_id   UUID REFERENCES review_comments(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_comments_review ON review_comments (review_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_parent ON review_comments (parent_id) WHERE parent_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_review_comments_updated_at ON review_comments;
CREATE TRIGGER set_review_comments_updated_at
  BEFORE UPDATE ON review_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ───────────────────────── REVIEW VOTES ─────────────────────────

CREATE TABLE IF NOT EXISTS review_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  value       SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_votes_unique ON review_votes (review_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_review ON review_votes (review_id);

-- ───────────────────────── LISTS: User-created lists ─────────────────────────

ALTER TABLE lists ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lists_owner_id_fkey'
      AND conrelid = 'lists'::regclass
  ) THEN
    ALTER TABLE lists
      ADD CONSTRAINT lists_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- ───────────────────────── GAMES: HLTB + Comparison columns ─────────────────────────

ALTER TABLE games ADD COLUMN IF NOT EXISTS hltb_main NUMERIC(6,1);
ALTER TABLE games ADD COLUMN IF NOT EXISTS hltb_extras NUMERIC(6,1);
ALTER TABLE games ADD COLUMN IF NOT EXISTS hltb_completionist NUMERIC(6,1);
ALTER TABLE games ADD COLUMN IF NOT EXISTS hltb_last_fetched TIMESTAMPTZ;
ALTER TABLE games ADD COLUMN IF NOT EXISTS franchise TEXT;

-- ───────────────────────── RLS POLICIES ─────────────────────────

-- user_games
ALTER TABLE user_games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read user_games" ON user_games;
CREATE POLICY "Public read user_games" ON user_games FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users insert own user_games" ON user_games;
CREATE POLICY "Users insert own user_games" ON user_games FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT id FROM profiles WHERE auth_id = auth.uid())
);
DROP POLICY IF EXISTS "Users update own user_games" ON user_games;
CREATE POLICY "Users update own user_games" ON user_games FOR UPDATE TO authenticated USING (
  user_id = (SELECT id FROM profiles WHERE auth_id = auth.uid())
);
DROP POLICY IF EXISTS "Users delete own user_games" ON user_games;
CREATE POLICY "Users delete own user_games" ON user_games FOR DELETE TO authenticated USING (
  user_id = (SELECT id FROM profiles WHERE auth_id = auth.uid())
);
DROP POLICY IF EXISTS "Service manage user_games" ON user_games;
CREATE POLICY "Service manage user_games" ON user_games FOR ALL TO service_role USING (true) WITH CHECK (true);

-- follows
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read follows" ON follows;
CREATE POLICY "Public read follows" ON follows FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users insert own follows" ON follows;
CREATE POLICY "Users insert own follows" ON follows FOR INSERT TO authenticated WITH CHECK (
  follower_id = (SELECT id FROM profiles WHERE auth_id = auth.uid())
);
DROP POLICY IF EXISTS "Users delete own follows" ON follows;
CREATE POLICY "Users delete own follows" ON follows FOR DELETE TO authenticated USING (
  follower_id = (SELECT id FROM profiles WHERE auth_id = auth.uid())
);
DROP POLICY IF EXISTS "Service manage follows" ON follows;
CREATE POLICY "Service manage follows" ON follows FOR ALL TO service_role USING (true) WITH CHECK (true);

-- review_comments
ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read comments" ON review_comments;
CREATE POLICY "Public read comments" ON review_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users insert own comments" ON review_comments;
CREATE POLICY "Users insert own comments" ON review_comments FOR INSERT TO authenticated WITH CHECK (
  profile_id = (SELECT id FROM profiles WHERE auth_id = auth.uid())
);
DROP POLICY IF EXISTS "Users update own comments" ON review_comments;
CREATE POLICY "Users update own comments" ON review_comments FOR UPDATE TO authenticated USING (
  profile_id = (SELECT id FROM profiles WHERE auth_id = auth.uid())
);
DROP POLICY IF EXISTS "Users delete own comments" ON review_comments;
CREATE POLICY "Users delete own comments" ON review_comments FOR DELETE TO authenticated USING (
  profile_id = (SELECT id FROM profiles WHERE auth_id = auth.uid())
);
DROP POLICY IF EXISTS "Service manage comments" ON review_comments;
CREATE POLICY "Service manage comments" ON review_comments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- review_votes
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read votes" ON review_votes;
CREATE POLICY "Public read votes" ON review_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users insert own votes" ON review_votes;
CREATE POLICY "Users insert own votes" ON review_votes FOR INSERT TO authenticated WITH CHECK (
  profile_id = (SELECT id FROM profiles WHERE auth_id = auth.uid())
);
DROP POLICY IF EXISTS "Users update own votes" ON review_votes;
CREATE POLICY "Users update own votes" ON review_votes FOR UPDATE TO authenticated USING (
  profile_id = (SELECT id FROM profiles WHERE auth_id = auth.uid())
);
DROP POLICY IF EXISTS "Users delete own votes" ON review_votes;
CREATE POLICY "Users delete own votes" ON review_votes FOR DELETE TO authenticated USING (
  profile_id = (SELECT id FROM profiles WHERE auth_id = auth.uid())
);
DROP POLICY IF EXISTS "Service manage votes" ON review_votes;
CREATE POLICY "Service manage votes" ON review_votes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can insert/update their own reviews
DROP POLICY IF EXISTS "Users insert own reviews" ON reviews;
CREATE POLICY "Users insert own reviews" ON reviews FOR INSERT TO authenticated WITH CHECK (
  profile_id = (SELECT id FROM profiles WHERE auth_id = auth.uid())
);
DROP POLICY IF EXISTS "Users update own reviews" ON reviews;
CREATE POLICY "Users update own reviews" ON reviews FOR UPDATE TO authenticated USING (
  profile_id = (SELECT id FROM profiles WHERE auth_id = auth.uid())
);

-- Authenticated users can manage own lists
DROP POLICY IF EXISTS "Users insert own lists" ON lists;
CREATE POLICY "Users insert own lists" ON lists FOR INSERT TO authenticated WITH CHECK (
  owner_id = (SELECT id FROM profiles WHERE auth_id = auth.uid())
);
DROP POLICY IF EXISTS "Users update own lists" ON lists;
CREATE POLICY "Users update own lists" ON lists FOR UPDATE TO authenticated USING (
  owner_id = (SELECT id FROM profiles WHERE auth_id = auth.uid())
);

-- Authenticated users can manage own profile
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE TO authenticated USING (
  auth_id = auth.uid()
);

-- ───────────────────────── AUTO-CREATE PROFILE ON SIGNUP ─────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (auth_id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'preferred_username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger on auth.users to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ───────────────────────── HELPFUL COUNT SYNC TRIGGER ─────────────────────────

CREATE OR REPLACE FUNCTION sync_review_helpful_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  _review_id UUID;
  _total INTEGER;
BEGIN
  _review_id := COALESCE(NEW.review_id, OLD.review_id);
  SELECT COALESCE(SUM(value), 0) INTO _total FROM public.review_votes WHERE review_id = _review_id;
  UPDATE public.reviews SET helpful = _total WHERE id = _review_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_votes_to_helpful ON review_votes;
CREATE TRIGGER sync_votes_to_helpful
  AFTER INSERT OR UPDATE OR DELETE ON review_votes
  FOR EACH ROW EXECUTE FUNCTION sync_review_helpful_count();
