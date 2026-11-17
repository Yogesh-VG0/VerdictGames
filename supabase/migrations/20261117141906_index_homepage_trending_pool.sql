-- Review-only: support the measured public trending ORDER BY without scanning
-- and sorting the wide games heap. No query, row, grant or RLS change.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='5s';
CREATE INDEX idx_games_homepage_trending_pool ON public.games (
  is_trending_manual DESC NULLS LAST,
  trending DESC NULLS LAST,
  current_players DESC NULLS LAST,
  momentum DESC NULLS LAST,
  verdict_score DESC NULLS LAST,
  review_count DESC NULLS LAST,
  score DESC
)
WHERE release_date IS NOT NULL
  AND cover_image IS NOT NULL AND cover_image<>''
  AND score>0;
COMMIT;
