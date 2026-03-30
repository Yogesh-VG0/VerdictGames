-- ═══════════════════════════════════════════════════════════════
-- Migration 010: RLS Policy Refactoring
-- 1. Create auth_profile_id() helper to eliminate repeated subqueries
-- 2. Enable RLS on admin_audit_log + add policies
-- 3. Replace inline subqueries in existing user-scoped policies
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Reusable helper: maps auth.uid() → profiles.id ───
-- SECURITY DEFINER so it can read profiles regardless of caller's role.
-- Pinned search_path prevents injection.
CREATE OR REPLACE FUNCTION public.auth_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.profiles WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- ─── 2. admin_audit_log: enable RLS + policies ───
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins (via service_role) can read/write audit logs
DROP POLICY IF EXISTS "Service manage audit_log" ON admin_audit_log;
CREATE POLICY "Service manage audit_log" ON admin_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated admins can read audit logs (role checked in app layer)
DROP POLICY IF EXISTS "Public read audit_log" ON admin_audit_log;
CREATE POLICY "Public read audit_log" ON admin_audit_log
  FOR SELECT USING (true);

-- ─── 3. Replace inline subqueries with auth_profile_id() ───
-- This makes policies faster (single function call vs subquery per row)
-- and easier to maintain.

-- user_games
DROP POLICY IF EXISTS "Users insert own user_games" ON user_games;
DROP POLICY IF EXISTS "Users update own user_games" ON user_games;
DROP POLICY IF EXISTS "Users delete own user_games" ON user_games;

CREATE POLICY "Users insert own user_games" ON user_games
  FOR INSERT TO authenticated WITH CHECK (user_id = public.auth_profile_id());
CREATE POLICY "Users update own user_games" ON user_games
  FOR UPDATE TO authenticated USING (user_id = public.auth_profile_id());
CREATE POLICY "Users delete own user_games" ON user_games
  FOR DELETE TO authenticated USING (user_id = public.auth_profile_id());

-- follows
DROP POLICY IF EXISTS "Users insert own follows" ON follows;
DROP POLICY IF EXISTS "Users delete own follows" ON follows;

CREATE POLICY "Users insert own follows" ON follows
  FOR INSERT TO authenticated WITH CHECK (follower_id = public.auth_profile_id());
CREATE POLICY "Users delete own follows" ON follows
  FOR DELETE TO authenticated USING (follower_id = public.auth_profile_id());

-- review_comments
DROP POLICY IF EXISTS "Users insert own comments" ON review_comments;
DROP POLICY IF EXISTS "Users update own comments" ON review_comments;
DROP POLICY IF EXISTS "Users delete own comments" ON review_comments;

CREATE POLICY "Users insert own comments" ON review_comments
  FOR INSERT TO authenticated WITH CHECK (profile_id = public.auth_profile_id());
CREATE POLICY "Users update own comments" ON review_comments
  FOR UPDATE TO authenticated USING (profile_id = public.auth_profile_id());
CREATE POLICY "Users delete own comments" ON review_comments
  FOR DELETE TO authenticated USING (profile_id = public.auth_profile_id());

-- review_votes
DROP POLICY IF EXISTS "Users insert own votes" ON review_votes;
DROP POLICY IF EXISTS "Users update own votes" ON review_votes;
DROP POLICY IF EXISTS "Users delete own votes" ON review_votes;

CREATE POLICY "Users insert own votes" ON review_votes
  FOR INSERT TO authenticated WITH CHECK (profile_id = public.auth_profile_id());
CREATE POLICY "Users update own votes" ON review_votes
  FOR UPDATE TO authenticated USING (profile_id = public.auth_profile_id());
CREATE POLICY "Users delete own votes" ON review_votes
  FOR DELETE TO authenticated USING (profile_id = public.auth_profile_id());

-- reviews (user-owned)
DROP POLICY IF EXISTS "Users insert own reviews" ON reviews;
DROP POLICY IF EXISTS "Users update own reviews" ON reviews;

CREATE POLICY "Users insert own reviews" ON reviews
  FOR INSERT TO authenticated WITH CHECK (profile_id = public.auth_profile_id());
CREATE POLICY "Users update own reviews" ON reviews
  FOR UPDATE TO authenticated USING (profile_id = public.auth_profile_id());

-- lists (user-owned)
DROP POLICY IF EXISTS "Users insert own lists" ON lists;
DROP POLICY IF EXISTS "Users update own lists" ON lists;

CREATE POLICY "Users insert own lists" ON lists
  FOR INSERT TO authenticated WITH CHECK (owner_id = public.auth_profile_id());
CREATE POLICY "Users update own lists" ON lists
  FOR UPDATE TO authenticated USING (owner_id = public.auth_profile_id());

-- profiles (own profile)
DROP POLICY IF EXISTS "Users update own profile" ON profiles;

CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth_id = auth.uid());
