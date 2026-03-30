UPDATE public.profiles AS p
SET auth_id = p.id
WHERE p.auth_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM auth.users AS u
    WHERE u.id = p.id
  );

DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
CREATE POLICY "Users insert own profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_id = (select auth.uid())
    AND COALESCE(role, 'user') = 'user'
  );
