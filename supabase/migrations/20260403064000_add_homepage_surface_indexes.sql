create index if not exists idx_games_homepage_recommendation_pool
  on public.games (verdict_score desc nulls last, score desc, release_date desc)
  where release_date is not null
    and cover_image is not null
    and cover_image <> ''
    and score >= 75
    and review_count >= 75
    and confidence >= 0.4;

create index if not exists idx_games_homepage_top_rated_pool
  on public.games (verdict_score desc nulls last, confidence desc nulls last, score desc, release_date desc)
  where release_date is not null
    and cover_image is not null
    and cover_image <> ''
    and score >= 70
    and review_count >= 75
    and confidence >= 0.3;
