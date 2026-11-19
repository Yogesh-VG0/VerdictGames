-- Exact new-index rollback only; existing indexes, source rows and grants remain.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='5s';
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261119153400' AND name='cover_browse_trending_ids' AND statements=ARRAY[
    '
SET LOCAL lock_timeout = ''2s'';',
    '
SET LOCAL statement_timeout = ''5s'';',
    '
CREATE INDEX idx_games_browse_trending_cover ON public.games (
  is_trending_manual DESC NULLS LAST,
  trending DESC NULLS LAST,
  current_players DESC NULLS LAST,
  momentum DESC NULLS LAST,
  verdict_score DESC NULLS LAST,
  review_count DESC NULLS LAST,
  id ASC
) INCLUDE (cover_image)
WHERE cover_image IS NOT NULL;'
  ]::text[]) THEN RAISE EXCEPTION 'Refuse rollback: reviewed ledger entry does not match'; END IF;
  IF pg_get_indexdef(to_regclass('public.idx_games_browse_trending_cover')) IS DISTINCT FROM 'CREATE INDEX idx_games_browse_trending_cover ON public.games USING btree (is_trending_manual DESC NULLS LAST, trending DESC NULLS LAST, current_players DESC NULLS LAST, momentum DESC NULLS LAST, verdict_score DESC NULLS LAST, review_count DESC NULLS LAST, id) INCLUDE (cover_image) WHERE (cover_image IS NOT NULL)' THEN RAISE EXCEPTION 'Refuse rollback: reviewed index definition does not match'; END IF;
END $guard$;
DROP INDEX public.idx_games_browse_trending_cover;
DELETE FROM supabase_migrations.schema_migrations WHERE version='20261119153400' AND name='cover_browse_trending_ids';
COMMIT;
