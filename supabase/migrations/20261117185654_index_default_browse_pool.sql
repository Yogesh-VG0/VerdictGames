-- Review-only: supports the observed default Browse query without changing
-- its predicates, ordering, source rows, permissions or application timeout.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='5s';
CREATE INDEX idx_games_default_browse_pool ON public.games (
  trending DESC NULLS LAST,
  verdict_score DESC NULLS LAST,
  release_date DESC,
  id ASC
)
-- Keep the predicate independent of bound review/score/empty-string values so
-- the same index remains usable by PostgREST generic prepared plans.
WHERE cover_image IS NOT NULL;
COMMIT;
