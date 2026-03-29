ALTER TABLE games
  ADD COLUMN IF NOT EXISTS steam_rating_label text,
  ADD COLUMN IF NOT EXISTS rawg_metacritic integer,
  ADD COLUMN IF NOT EXISTS rawg_rating real,
  ADD COLUMN IF NOT EXISTS score_source text NOT NULL DEFAULT 'blended';

UPDATE games
SET score_source = 'steam'
WHERE score_source = 'blended'
  AND user_score IS NOT NULL
  AND steam_app_id IS NOT NULL;

UPDATE games
SET score_source = 'igdb'
WHERE score_source = 'blended'
  AND igdb_rating IS NOT NULL;
