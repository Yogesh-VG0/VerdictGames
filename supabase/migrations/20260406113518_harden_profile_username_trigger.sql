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
  _raw_name := COALESCE(
    NEW.raw_user_meta_data ->> 'preferred_username',
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(NEW.email, '@', 1)
  );

  _base := substring(lower(regexp_replace(_raw_name, '[^a-zA-Z0-9_]', '', 'g')) FROM 1 FOR 24);
  IF length(_base) < 3 OR _base IN (
    'admin',
    'administrator',
    'mod',
    'moderator',
    'system',
    'verdict',
    'verdictgames',
    'support',
    'help',
    'staff',
    'official',
    'root',
    'null',
    'undefined',
    'api',
    'www',
    'blog',
    'news'
  ) THEN
    _base := 'user';
  END IF;

  _final := _base;

  LOOP
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = _final) INTO _exists;
    EXIT WHEN NOT _exists AND _final NOT IN (
      'admin',
      'administrator',
      'mod',
      'moderator',
      'system',
      'verdict',
      'verdictgames',
      'support',
      'help',
      'staff',
      'official',
      'root',
      'null',
      'undefined',
      'api',
      'www',
      'blog',
      'news'
    );
    _attempts := _attempts + 1;
    IF _attempts > 20 THEN
      RAISE EXCEPTION 'Could not allocate an available username';
    END IF;
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
