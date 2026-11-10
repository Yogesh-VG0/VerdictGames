-- Trigger entrypoints do not need to be callable through the public Data API.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- Profiles are publicly selectable, so this policy helper does not need to
-- borrow its owner's privileges. Preserve authenticated policy evaluation.
ALTER FUNCTION public.is_admin_user() SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated, service_role;

DROP POLICY IF EXISTS "Service manage Steam refresh state" ON public.steam_review_refresh_state;
CREATE POLICY "Service manage Steam refresh state" ON public.steam_review_refresh_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service manage API rate limits" ON public.api_rate_limits;
CREATE POLICY "Service manage API rate limits" ON public.api_rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);
