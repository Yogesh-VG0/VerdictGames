-- VG-005/VG-006/VG-007. Apply only after the matching application changes.
-- No data is deleted or rewritten. Existing public profile fields and public
-- avatar URLs remain available; private library rows are owner-scoped.
BEGIN;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO anon, authenticated, service_role;

-- These no-argument helpers expose only the caller's identity/authorization.
-- They live outside the exposed API schema, with a fixed empty search_path.
-- Borrowing privileges is necessary because auth_id/role are no longer public.
CREATE OR REPLACE FUNCTION app_private.current_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id FROM public.profiles p
  WHERE p.auth_id = (SELECT auth.uid())
$$;
REVOKE ALL ON FUNCTION app_private.current_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.current_profile_id() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.current_user_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.auth_id = (SELECT auth.uid()) AND p.role = 'admin')
$$;
REVOKE ALL ON FUNCTION app_private.current_user_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.current_user_is_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auth_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT app_private.current_profile_id()
$$;
REVOKE ALL ON FUNCTION public.auth_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_profile_id() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT app_private.current_user_is_admin()
$$;
REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated, service_role;

-- Reconcile older inline-role policies as well as the deployed helper-based
-- policies, so replay/local verification cannot depend on public role reads.
DROP POLICY IF EXISTS "Admins can manage editorial reviews" ON public.editorial_reviews;
DROP POLICY IF EXISTS "Admins can read editorial reviews" ON public.editorial_reviews;
DROP POLICY IF EXISTS "Public can read published editorial reviews" ON public.editorial_reviews;
DROP POLICY IF EXISTS "Admins can read unpublished editorial reviews" ON public.editorial_reviews;
CREATE POLICY "Public can read published editorial reviews" ON public.editorial_reviews
  FOR SELECT TO anon, authenticated USING (is_published = true);
CREATE POLICY "Admins can read unpublished editorial reviews" ON public.editorial_reviews
  FOR SELECT TO authenticated USING ((SELECT public.is_admin_user()));
DROP POLICY IF EXISTS "Admins can insert editorial reviews" ON public.editorial_reviews;
CREATE POLICY "Admins can insert editorial reviews" ON public.editorial_reviews
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT public.is_admin_user()) AND author_id = (SELECT public.auth_profile_id()));
DROP POLICY IF EXISTS "Admins can update editorial reviews" ON public.editorial_reviews;
CREATE POLICY "Admins can update editorial reviews" ON public.editorial_reviews
  FOR UPDATE TO authenticated USING ((SELECT public.is_admin_user()))
  WITH CHECK ((SELECT public.is_admin_user()));
DROP POLICY IF EXISTS "Admins can delete editorial reviews" ON public.editorial_reviews;
CREATE POLICY "Admins can delete editorial reviews" ON public.editorial_reviews
  FOR DELETE TO authenticated USING ((SELECT public.is_admin_user()));
ALTER FUNCTION public.update_editorial_review_timestamp() SET search_path = '';

-- Table-level SELECT would override a column revoke. Clear table AND existing
-- column grants, then allow only intentionally public presentation columns.
REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
DO $$ DECLARE col text; BEGIN
  FOR col IN SELECT attname FROM pg_attribute
    WHERE attrelid = 'public.profiles'::regclass AND attnum > 0 AND NOT attisdropped
  LOOP
    EXECUTE format('REVOKE ALL (%I) ON public.profiles FROM PUBLIC, anon, authenticated', col);
  END LOOP;
END $$;
GRANT SELECT (id, username, display_name, avatar_url, bio, favorite_genres, joined_at, updated_at)
  ON public.profiles TO anon, authenticated;
GRANT UPDATE (username, display_name, avatar_url, bio, favorite_genres)
  ON public.profiles TO authenticated;

REVOKE ALL ON public.user_games FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_games TO authenticated;
DROP POLICY IF EXISTS "Public read user_games" ON public.user_games;
DROP POLICY IF EXISTS "Users read own user_games" ON public.user_games;
CREATE POLICY "Users read own user_games" ON public.user_games
  FOR SELECT TO authenticated USING (user_id = (SELECT public.auth_profile_id()));
DROP POLICY IF EXISTS "Users update own user_games" ON public.user_games;
CREATE POLICY "Users update own user_games" ON public.user_games
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT public.auth_profile_id()))
  WITH CHECK (user_id = (SELECT public.auth_profile_id()));

-- Public catalogue writes are server-only. Owner mutation paths retain their
-- commands and RLS; administrative writes still use service_role.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.games FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.lists, public.list_items, public.reviews, public.review_votes,
     public.review_comments, public.follows FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON public.lists, public.list_items, public.reviews, public.review_votes,
     public.review_comments, public.follows FROM authenticated;

-- Keep legacy UUID.ext avatar URLs working. New UUID/avatar.ext names also
-- work. Match complete path components, never a loose starts-with predicate.
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (
    name IN ((SELECT auth.uid())::text || '.jpeg', (SELECT auth.uid())::text || '.jpg',
             (SELECT auth.uid())::text || '.png', (SELECT auth.uid())::text || '.webp')
    OR (storage.foldername(name))[1] = (SELECT auth.uid())::text));
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (
    name IN ((SELECT auth.uid())::text || '.jpeg', (SELECT auth.uid())::text || '.jpg',
             (SELECT auth.uid())::text || '.png', (SELECT auth.uid())::text || '.webp')
    OR (storage.foldername(name))[1] = (SELECT auth.uid())::text))
  WITH CHECK (bucket_id = 'avatars' AND (
    name IN ((SELECT auth.uid())::text || '.jpeg', (SELECT auth.uid())::text || '.jpg',
             (SELECT auth.uid())::text || '.png', (SELECT auth.uid())::text || '.webp')
    OR (storage.foldername(name))[1] = (SELECT auth.uid())::text));
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (
    name IN ((SELECT auth.uid())::text || '.jpeg', (SELECT auth.uid())::text || '.jpg',
             (SELECT auth.uid())::text || '.png', (SELECT auth.uid())::text || '.webp')
    OR (storage.foldername(name))[1] = (SELECT auth.uid())::text));

NOTIFY pgrst, 'reload schema';
COMMIT;
