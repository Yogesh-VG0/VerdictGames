-- PROPOSAL ONLY. Exactly two independently verified public catalogue statuses.
-- Original historical tags, provider identities, dates, scores and relations stay.
BEGIN;
SET LOCAL lock_timeout='500ms';
SET LOCAL statement_timeout='3s';
-- Lock exactly the reviewed IDs before checking identities or source values.
SELECT id FROM public.games WHERE id IN('c241eb7d-a5d5-4f7b-bd61-07c9123aea94','77f8fd50-f942-4f17-96be-53c15282f4e4') ORDER BY id FOR UPDATE;
DO $preflight$
BEGIN
  IF (SELECT count(*) FROM public.games WHERE
    (id='c241eb7d-a5d5-4f7b-bd61-07c9123aea94' AND slug='hades' AND igdb_id=113112 AND steam_app_id=1145360 AND release_date='2020-09-17')
    OR (id='77f8fd50-f942-4f17-96be-53c15282f4e4' AND slug='hades-ii' AND igdb_id=228525 AND steam_app_id=1145350 AND release_date='2025-09-25')) <> 2
    OR EXISTS(SELECT 1 FROM public.games WHERE id IN('c241eb7d-a5d5-4f7b-bd61-07c9123aea94','77f8fd50-f942-4f17-96be-53c15282f4e4')
      AND (release_status IS NOT NULL OR explore_early_access IS NOT TRUE OR NOT tags @> ARRAY['Early Access']))
    OR public.explore_early_access('released',ARRAY['Early Access'],'{}') IS DISTINCT FROM false
    OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.games'::regclass AND tgname='zzz_refresh_explore_classification' AND tgenabled IN('O','A'))
    OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.games'::regclass AND tgname='refresh_explore_inputs' AND tgenabled IN('O','A'))
    OR NOT coalesce((SELECT ready FROM public.explore_input_state WHERE singleton),false)
  THEN RAISE EXCEPTION 'Reviewed release-status preflight failed; no repair applied'; END IF;
END $preflight$;
-- Capture all source fields under those same row locks.
CREATE TEMP TABLE release_status_repair_before ON COMMIT DROP AS
 SELECT id,to_jsonb(g) AS original FROM public.games g
 WHERE id IN('c241eb7d-a5d5-4f7b-bd61-07c9123aea94','77f8fd50-f942-4f17-96be-53c15282f4e4');
UPDATE public.games SET release_status='released'
 WHERE id IN('c241eb7d-a5d5-4f7b-bd61-07c9123aea94','77f8fd50-f942-4f17-96be-53c15282f4e4') AND release_status IS NULL;
DO $verify$
BEGIN
 IF (SELECT count(*) FROM release_status_repair_before)<>2
   OR EXISTS(SELECT 1 FROM release_status_repair_before b LEFT JOIN public.games g USING(id)
     WHERE g.id IS NULL OR g.release_status<>'released' OR g.explore_early_access IS DISTINCT FROM false
       OR (to_jsonb(g)-ARRAY['release_status','updated_at','explore_early_access'])
          IS DISTINCT FROM (b.original-ARRAY['release_status','updated_at','explore_early_access']))
   OR EXISTS(SELECT 1 FROM release_status_repair_before b JOIN public.games g USING(id) LEFT JOIN public.explore_inputs i USING(id)
     WHERE ROW(g.id,g.slug,g.title,g.release_date,g.steam_app_id,g.review_count,g.platforms,g.genres,g.tags,g.created_at,g.current_players,g.verdict_score,g.score,g.confidence,g.release_status,g.explore_title_key,g.explore_year_suffix,g.explore_franchise_key,g.explore_developer_key,g.explore_publisher_key,g.explore_primary_safe,g.explore_early_access)
       IS DISTINCT FROM ROW(i.id,i.slug,i.title,i.release_date,i.steam_app_id,i.review_count,i.platforms,i.genres,i.tags,i.created_at,i.current_players,i.verdict_score,i.score,i.confidence,i.release_status,i.explore_title_key,i.explore_year_suffix,i.explore_franchise_key,i.explore_developer_key,i.explore_publisher_key,i.explore_primary_safe,i.explore_early_access))
 THEN RAISE EXCEPTION 'Release-status repair verification failed; transaction rolled back'; END IF;
END $verify$;
COMMIT;
