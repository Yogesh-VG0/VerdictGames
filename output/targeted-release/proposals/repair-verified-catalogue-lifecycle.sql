-- PROPOSED ONLY. Exact project: vjzsvnaswronkctazarn. Application first.
-- Four existing public records; no score/date/identity changes, DDL or ledger replay.
BEGIN;
SET LOCAL lock_timeout='500ms';
SET LOCAL statement_timeout='3s';
DO $repair$
DECLARE target record; before_row jsonb; after_row jsonb;
  mutable text[] := ARRAY['release_status','updated_at','explore_title_key','explore_year_suffix',
    'explore_franchise_key','explore_developer_key','explore_publisher_key','explore_primary_safe','explore_early_access'];
BEGIN
  IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.games'::regclass
      AND tgname IN ('zzz_refresh_explore_classification','refresh_explore_inputs') AND tgenabled='O')<>2
    OR NOT EXISTS(SELECT 1 FROM public.explore_input_state WHERE singleton AND ready) THEN
    RAISE EXCEPTION 'Required derived-field safeguards are not ready';
  END IF;
  FOR target IN SELECT * FROM (VALUES
    ('d0166b0d-40f8-4b1e-bcc9-b18ab9391429'::uuid,'prince-of-persia-the-sands-of-time-remake',490430,NULL::date,'cancelled'),
    ('19967cd1-8554-4bc9-9299-30cb8e1a6016'::uuid,'titan-quest-2',469645,'2027-01-19'::date,'early_access'),
    ('31180c23-4722-46cc-92e2-f491d38a58d7'::uuid,'grand-theft-auto-vi',972995,'2026-11-19'::date,'released'),
    ('f1fa15c5-1aa7-4da4-a804-a0546312c0f9'::uuid,'final-fantasy-resonance',1018134,'2026-10-22'::date,'released')
  ) AS expected(id,slug,rawg_id,release_date,new_status)
  LOOP
    SELECT to_jsonb(g) INTO before_row FROM public.games g WHERE g.id=target.id FOR UPDATE;
    IF before_row IS NULL OR before_row->>'slug'<>target.slug
      OR (before_row->>'rawg_id')::integer<>target.rawg_id
      OR (before_row->>'release_date')::date IS DISTINCT FROM target.release_date
      OR before_row->>'release_status' IS NOT NULL THEN
      RAISE EXCEPTION 'Source identity/state changed; stop and review';
    END IF;
    UPDATE public.games SET release_status=target.new_status WHERE id=target.id;
    SELECT to_jsonb(g) INTO after_row FROM public.games g WHERE g.id=target.id;
    IF before_row-mutable IS DISTINCT FROM after_row-mutable
      OR after_row->>'release_status'<>target.new_status THEN
      RAISE EXCEPTION 'Unapproved source field changed';
    END IF;
  END LOOP;
END;
$repair$;
COMMIT;
