-- Track the freshness of Steam current-player counts.
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS players_updated_at timestamptz;

UPDATE public.games
SET players_updated_at = COALESCE(last_enriched_at, NOW())
WHERE current_players IS NOT NULL
  AND players_updated_at IS NULL;
