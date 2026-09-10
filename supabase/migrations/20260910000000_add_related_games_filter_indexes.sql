create index if not exists idx_games_genres_gin
  on public.games using gin (genres);

create index if not exists idx_games_tags_gin
  on public.games using gin (tags);

create index if not exists idx_games_developer
  on public.games (developer)
  where developer <> '';

create index if not exists idx_games_franchise
  on public.games (franchise)
  where franchise is not null and franchise <> '';
