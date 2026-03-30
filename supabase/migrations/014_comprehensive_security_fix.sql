-- ═══════════════════════════════════════════════════════════════════
-- Migration 014: Comprehensive Security & Performance Fix
--
-- Fixes discovered by Supabase security + performance advisors:
--
-- CRITICAL SECURITY:
--   1. 9 "Service" write policies were on {public} role instead of
--      {service_role} — any anonymous user could INSERT/UPDATE/DELETE
--      games, profiles, reviews, lists, game_sources, list_items,
--      admin_audit_log, steam_reviews, ingest_runs
--   2. scheduler_runs had RLS completely disabled
--   3. update_msl_updated_at and update_updated_at_column functions
--      had mutable search_path (search_path injection risk)
--
-- PERFORMANCE:
--   4. Created auth_profile_id() helper function
--   5. Optimized all user-scoped RLS policies to use
--      (select auth_profile_id()) instead of inline subqueries
--   6. Added missing foreign key indexes
--
-- AUTH:
--   7. Enable "Leaked Password Protection" in Supabase Dashboard
--      (Settings → Auth → Password Security)
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- 1. Create auth_profile_id() helper + fix function search_paths
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auth_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT id FROM public.profiles WHERE auth_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_msl_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ───────────────────────────────────────────────────────────────────
-- 2. Enable RLS on scheduler_runs
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scheduler_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  duration_ms integer,
  rows_scanned integer DEFAULT 0,
  rows_created integer DEFAULT 0,
  rows_updated integer DEFAULT 0,
  rows_skipped integer DEFAULT 0,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduler_runs_job_name
  ON scheduler_runs (job_name, started_at DESC);

ALTER TABLE scheduler_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read scheduler_runs" ON scheduler_runs;
CREATE POLICY "Public read scheduler_runs"
  ON scheduler_runs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service manage scheduler_runs" ON scheduler_runs;
CREATE POLICY "Service manage scheduler_runs"
  ON scheduler_runs FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ───────────────────────────────────────────────────────────────────
-- 3. Fix all service policies: drop {public} → recreate {service_role}
-- ───────────────────────────────────────────────────────────────────

-- games
DROP POLICY IF EXISTS "Service insert games" ON games;
DROP POLICY IF EXISTS "Service update games" ON games;
DROP POLICY IF EXISTS "Service delete games" ON games;
CREATE POLICY "Service insert games" ON games FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service update games" ON games FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service delete games" ON games FOR DELETE TO service_role USING (true);

-- game_sources
DROP POLICY IF EXISTS "Service insert game_sources" ON game_sources;
DROP POLICY IF EXISTS "Service update game_sources" ON game_sources;
CREATE POLICY "Service insert game_sources" ON game_sources FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service update game_sources" ON game_sources FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- list_items
DROP POLICY IF EXISTS "Service insert list_items" ON list_items;
DROP POLICY IF EXISTS "Service delete list_items" ON list_items;
CREATE POLICY "Service insert list_items" ON list_items FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service delete list_items" ON list_items FOR DELETE TO service_role USING (true);

-- lists
DROP POLICY IF EXISTS "Service insert lists" ON lists;
DROP POLICY IF EXISTS "Service update lists" ON lists;
CREATE POLICY "Service insert lists" ON lists FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service update lists" ON lists FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- profiles
DROP POLICY IF EXISTS "Service insert profiles" ON profiles;
DROP POLICY IF EXISTS "Service update profiles" ON profiles;
CREATE POLICY "Service insert profiles" ON profiles FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service update profiles" ON profiles FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- reviews
DROP POLICY IF EXISTS "Service insert reviews" ON reviews;
DROP POLICY IF EXISTS "Service update reviews" ON reviews;
CREATE POLICY "Service insert reviews" ON reviews FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service update reviews" ON reviews FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- admin_audit_log
DROP POLICY IF EXISTS "Service role full access on admin_audit_log" ON admin_audit_log;
DROP POLICY IF EXISTS "Service manage audit_log" ON admin_audit_log;
DROP POLICY IF EXISTS "Public read audit_log" ON admin_audit_log;
DROP POLICY IF EXISTS "Service manage audit_log" ON admin_audit_log;
CREATE POLICY "Service manage audit_log" ON admin_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- steam_reviews
DROP POLICY IF EXISTS "Service role can manage steam reviews" ON steam_reviews;
DROP POLICY IF EXISTS "Service manage steam_reviews" ON steam_reviews;
CREATE POLICY "Service manage steam_reviews" ON steam_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ingest_runs
DROP POLICY IF EXISTS "Service role can manage ingest runs" ON ingest_runs;
DROP POLICY IF EXISTS "Service manage ingest_runs" ON ingest_runs;
CREATE POLICY "Service manage ingest_runs" ON ingest_runs FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ───────────────────────────────────────────────────────────────────
-- 4. Optimize user-scoped policies: (select auth_profile_id())
--    Prevents per-row re-evaluation of auth functions
-- ───────────────────────────────────────────────────────────────────

-- user_games
DROP POLICY IF EXISTS "Users insert own user_games" ON user_games;
DROP POLICY IF EXISTS "Users update own user_games" ON user_games;
DROP POLICY IF EXISTS "Users delete own user_games" ON user_games;
CREATE POLICY "Users insert own user_games" ON user_games FOR INSERT TO authenticated
  WITH CHECK (user_id = (select public.auth_profile_id()));
CREATE POLICY "Users update own user_games" ON user_games FOR UPDATE TO authenticated
  USING (user_id = (select public.auth_profile_id()));
CREATE POLICY "Users delete own user_games" ON user_games FOR DELETE TO authenticated
  USING (user_id = (select public.auth_profile_id()));

-- follows
DROP POLICY IF EXISTS "Users insert own follows" ON follows;
DROP POLICY IF EXISTS "Users delete own follows" ON follows;
CREATE POLICY "Users insert own follows" ON follows FOR INSERT TO authenticated
  WITH CHECK (follower_id = (select public.auth_profile_id()));
CREATE POLICY "Users delete own follows" ON follows FOR DELETE TO authenticated
  USING (follower_id = (select public.auth_profile_id()));

-- review_comments
DROP POLICY IF EXISTS "Users insert own comments" ON review_comments;
DROP POLICY IF EXISTS "Users update own comments" ON review_comments;
DROP POLICY IF EXISTS "Users delete own comments" ON review_comments;
CREATE POLICY "Users insert own comments" ON review_comments FOR INSERT TO authenticated
  WITH CHECK (profile_id = (select public.auth_profile_id()));
CREATE POLICY "Users update own comments" ON review_comments FOR UPDATE TO authenticated
  USING (profile_id = (select public.auth_profile_id()));
CREATE POLICY "Users delete own comments" ON review_comments FOR DELETE TO authenticated
  USING (profile_id = (select public.auth_profile_id()));

-- review_votes
DROP POLICY IF EXISTS "Users insert own votes" ON review_votes;
DROP POLICY IF EXISTS "Users update own votes" ON review_votes;
DROP POLICY IF EXISTS "Users delete own votes" ON review_votes;
CREATE POLICY "Users insert own votes" ON review_votes FOR INSERT TO authenticated
  WITH CHECK (profile_id = (select public.auth_profile_id()));
CREATE POLICY "Users update own votes" ON review_votes FOR UPDATE TO authenticated
  USING (profile_id = (select public.auth_profile_id()));
CREATE POLICY "Users delete own votes" ON review_votes FOR DELETE TO authenticated
  USING (profile_id = (select public.auth_profile_id()));

-- reviews
DROP POLICY IF EXISTS "Users insert own reviews" ON reviews;
DROP POLICY IF EXISTS "Users update own reviews" ON reviews;
CREATE POLICY "Users insert own reviews" ON reviews FOR INSERT TO authenticated
  WITH CHECK (profile_id = (select public.auth_profile_id()));
CREATE POLICY "Users update own reviews" ON reviews FOR UPDATE TO authenticated
  USING (profile_id = (select public.auth_profile_id()));

-- lists
DROP POLICY IF EXISTS "Users insert own lists" ON lists;
DROP POLICY IF EXISTS "Users update own lists" ON lists;
CREATE POLICY "Users insert own lists" ON lists FOR INSERT TO authenticated
  WITH CHECK (owner_id = (select public.auth_profile_id()));
CREATE POLICY "Users update own lists" ON lists FOR UPDATE TO authenticated
  USING (owner_id = (select public.auth_profile_id()));

-- profiles
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE TO authenticated
  USING (auth_id = (select auth.uid()));


-- ───────────────────────────────────────────────────────────────────
-- 5. Add missing foreign key indexes
-- ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_lists_owner_id ON lists(owner_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_profile_id ON review_comments(profile_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_profile_id ON review_votes(profile_id);
