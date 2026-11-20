-- The bounded Browse reader selects IDs before hydrating public game cards.
-- Cover the remaining image predicate so PostgreSQL can use an index-only scan.
-- Keep the existing ordering index until hosted verification establishes benefit.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '5s';
CREATE INDEX idx_games_browse_trending_cover ON public.games (
  is_trending_manual DESC NULLS LAST,
  trending DESC NULLS LAST,
  current_players DESC NULLS LAST,
  momentum DESC NULLS LAST,
  verdict_score DESC NULLS LAST,
  review_count DESC NULLS LAST,
  id ASC
) INCLUDE (cover_image)
WHERE cover_image IS NOT NULL;
COMMIT;
