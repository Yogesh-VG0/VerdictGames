-- Correct only the demonstrated production Browse Trending sort timeout.
-- Preserve predicates, ranking/ties, source rows, grants, RLS and timeouts.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='5s';
CREATE INDEX idx_games_browse_trending_pool ON public.games (
  is_trending_manual DESC NULLS LAST,
  trending DESC NULLS LAST,
  current_players DESC NULLS LAST,
  momentum DESC NULLS LAST,
  verdict_score DESC NULLS LAST,
  review_count DESC NULLS LAST,
  id ASC
)
WHERE cover_image IS NOT NULL;
COMMIT;
