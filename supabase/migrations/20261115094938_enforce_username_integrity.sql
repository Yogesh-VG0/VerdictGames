-- Local-tested proposal; hosted application requires owner approval.
BEGIN;
-- Fail rather than rename or merge a colliding identity. Legacy names remain
-- readable; the trigger validates new names and deliberate username edits only.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles GROUP BY lower(username) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Username preflight failed: review case collisions before applying';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_normalized_key
  ON public.profiles (lower(username));

CREATE OR REPLACE FUNCTION public.validate_profile_username()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.username IS NOT DISTINCT FROM OLD.username THEN
    RETURN NEW;
  END IF;
  NEW.username := lower(btrim(NEW.username));
  IF NEW.username IS NULL OR NEW.username !~ '^[a-z0-9_]{3,24}$'
    OR NEW.username = ANY(ARRAY['admin','administrator','mod','moderator','system',
      'verdict','verdictgames','support','help','staff','official','root','null',
      'undefined','api','www','blog','news']) THEN
    RAISE EXCEPTION 'Invalid or reserved username' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_profile_username() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_profile_username BEFORE INSERT OR UPDATE OF username
  ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_profile_username();
COMMIT;
