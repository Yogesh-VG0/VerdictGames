-- ═══════════════════════════════════════════════════════════════
-- Migration 002: Security lint fixes
-- Fixes Supabase linter warnings:
--   • function_search_path_mutable  — pin search_path on trigger fn
--   • rls_policy_always_true        — scope service policies to service_role
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Fix function search_path ────────────────────────────
-- Re-create with SET search_path = '' to prevent search_path injection.
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

-- ─── 2. Fix RLS policies: scope to service_role ─────────────
-- Drop the old permissive-to-all policies, recreate with TO service_role.

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

-- reviews
DROP POLICY IF EXISTS "Service insert reviews" ON reviews;
DROP POLICY IF EXISTS "Service update reviews" ON reviews;

CREATE POLICY "Service insert reviews" ON reviews FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service update reviews" ON reviews FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- profiles
DROP POLICY IF EXISTS "Service insert profiles" ON profiles;
DROP POLICY IF EXISTS "Service update profiles" ON profiles;

CREATE POLICY "Service insert profiles" ON profiles FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service update profiles" ON profiles FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- lists
DROP POLICY IF EXISTS "Service insert lists" ON lists;
DROP POLICY IF EXISTS "Service update lists" ON lists;

CREATE POLICY "Service insert lists" ON lists FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service update lists" ON lists FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- list_items
DROP POLICY IF EXISTS "Service insert list_items" ON list_items;
DROP POLICY IF EXISTS "Service delete list_items" ON list_items;

CREATE POLICY "Service insert list_items" ON list_items FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service delete list_items" ON list_items FOR DELETE TO service_role USING (true);
