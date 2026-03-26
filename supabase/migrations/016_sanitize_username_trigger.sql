-- ═══════════════════════════════════════════════════════════════
-- Migration 016: Sanitize Username in Auto-Create Trigger
-- Ensures usernames created by the auth trigger are:
--   - Lowercase
--   - Only alphanumeric + underscore
--   - 3-24 characters
--   - Unique (appends random suffix if taken)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _raw_name TEXT;
  _base TEXT;
  _final TEXT;
  _suffix TEXT;
  _exists BOOLEAN;
  _attempts INT := 0;
BEGIN
  -- Extract preferred username from metadata
  _raw_name := COALESCE(
    NEW.raw_user_meta_data ->> 'preferred_username',
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(NEW.email, '@', 1)
  );

  -- Sanitize: lowercase, strip non-alphanumeric/underscore, limit to 24 chars
  _base := substring(lower(regexp_replace(_raw_name, '[^a-zA-Z0-9_]', '', 'g')) FROM 1 FOR 24);
  IF length(_base) < 3 THEN
    _base := 'user';
  END IF;

  _final := _base;

  -- Check uniqueness, append random 4-digit suffix if taken
  LOOP
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = _final) INTO _exists;
    EXIT WHEN NOT _exists;
    _attempts := _attempts + 1;
    EXIT WHEN _attempts > 5;
    _suffix := floor(1000 + random() * 9000)::TEXT;
    _final := substring(_base FROM 1 FOR 19) || '_' || _suffix;
  END LOOP;

  INSERT INTO public.profiles (auth_id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    _final,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );
  RETURN NEW;
END;
$$;
