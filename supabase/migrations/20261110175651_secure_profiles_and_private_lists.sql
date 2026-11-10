-- Owner RLS does not restrict columns. Keep identity and privilege writes on
-- the trusted server; browser clients may update only presentation fields.
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM PUBLIC, anon, authenticated;

DO $$
DECLARE column_name text;
BEGIN
  FOR column_name IN
    SELECT a.attname FROM pg_attribute a
    WHERE a.attrelid = 'public.profiles'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped
  LOOP
    EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON public.profiles FROM PUBLIC, anon, authenticated', column_name, column_name);
  END LOOP;
END $$;

GRANT UPDATE (username, display_name, avatar_url, bio, favorite_genres)
  ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth_id = (SELECT auth.uid()))
  WITH CHECK (auth_id = (SELECT auth.uid()));

-- Visibility must also hold when clients call the Data API directly.
DROP POLICY IF EXISTS "Public read lists" ON public.lists;
CREATE POLICY "Public read lists" ON public.lists
  FOR SELECT TO anon, authenticated
  USING (is_public OR owner_id = (SELECT public.auth_profile_id()));

DROP POLICY IF EXISTS "Public read list_items" ON public.list_items;
CREATE POLICY "Public read list_items" ON public.list_items
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lists l WHERE l.id = list_items.list_id
      AND (l.is_public OR l.owner_id = (SELECT public.auth_profile_id()))
  ));
