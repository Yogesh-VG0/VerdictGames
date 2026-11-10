CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX IF NOT EXISTS idx_games_title_trgm ON public.games USING gin (title extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_games_developer_trgm ON public.games USING gin (developer extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_games_publisher_trgm ON public.games USING gin (publisher extensions.gin_trgm_ops);
ANALYZE public.games;
