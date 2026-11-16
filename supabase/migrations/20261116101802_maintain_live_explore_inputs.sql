-- Proposed metadata-only setup: live compact inputs, exact source fallback,
-- no stored ranks. Separate bounded backfill/validation publishes readiness.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='5s';
CREATE FUNCTION public.explore_source_unrestricted() RETURNS boolean
 LANGUAGE sql STABLE PARALLEL SAFE SECURITY INVOKER SET search_path='' AS $guard$
 SELECT pg_catalog.has_table_privilege(current_user,'public.games','SELECT') AND (
  NOT pg_catalog.row_security_active('public.games'::regclass) OR (
    pg_catalog.current_setting('transaction_isolation') IN ('read committed','read uncommitted') AND
    EXISTS (SELECT 1 FROM pg_catalog.pg_policy p
      WHERE p.polrelid='public.games'::regclass AND p.polcmd IN ('r','*') AND p.polpermissive
       AND pg_catalog.pg_get_expr(p.polqual,p.polrelid)='true'
       AND (0=ANY(p.polroles) OR EXISTS(SELECT 1 FROM unnest(p.polroles) role_id
          WHERE CASE WHEN role_id=0 THEN false ELSE pg_catalog.pg_has_role(current_user,role_id,'USAGE') END)))
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy p
      WHERE p.polrelid='public.games'::regclass AND p.polcmd IN ('r','*') AND NOT p.polpermissive
       AND (0=ANY(p.polroles) OR EXISTS(SELECT 1 FROM unnest(p.polroles) role_id
          WHERE CASE WHEN role_id=0 THEN false ELSE pg_catalog.pg_has_role(current_user,role_id,'USAGE') END)))
  ));
$guard$;
REVOKE ALL ON FUNCTION public.explore_source_unrestricted() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.explore_source_unrestricted() TO anon,authenticated,service_role;
COMMENT ON FUNCTION public.explore_source_unrestricted() IS 'Conservative invoker guard: source SELECT plus no active RLS, or a provably unconditional applicable permissive policy and no applicable restrictive policy. Unknown conditions fail closed.';

CREATE TABLE public.explore_inputs AS SELECT id,slug,title,release_date,steam_app_id,review_count,platforms,genres,tags,created_at,current_players,verdict_score,score,confidence,release_status,explore_title_key,explore_year_suffix,explore_franchise_key,explore_developer_key,explore_publisher_key,explore_primary_safe,explore_early_access FROM public.games WITH NO DATA;
ALTER TABLE public.explore_inputs ADD PRIMARY KEY(id);
ALTER TABLE public.explore_inputs ADD CONSTRAINT explore_inputs_game_fk FOREIGN KEY(id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE TABLE public.explore_input_state(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),ready boolean NOT NULL DEFAULT false);
INSERT INTO public.explore_input_state(singleton,ready) VALUES(true,false);
ALTER TABLE public.explore_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.explore_input_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.explore_inputs,public.explore_input_state FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.explore_inputs,public.explore_input_state TO anon,authenticated,service_role;
CREATE POLICY explore_inputs_source_visibility ON public.explore_inputs FOR SELECT TO anon,authenticated,service_role
 USING ((SELECT public.explore_source_unrestricted()));
CREATE POLICY explore_input_state_public ON public.explore_input_state FOR SELECT TO anon,authenticated,service_role USING(true);
CREATE FUNCTION public.refresh_explore_inputs() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $maintain$
BEGIN
 IF TG_RELID <> 'public.games'::regclass OR TG_WHEN <> 'AFTER' OR TG_LEVEL <> 'ROW' OR TG_OP NOT IN ('INSERT','UPDATE') THEN
  RAISE EXCEPTION 'Invalid Explore input maintenance trigger context' USING ERRCODE='42501';
 END IF;
 IF TG_OP='UPDATE' AND ROW(OLD.id,OLD.slug,OLD.title,OLD.release_date,OLD.steam_app_id,OLD.review_count,OLD.platforms,OLD.genres,OLD.tags,OLD.created_at,OLD.current_players,OLD.verdict_score,OLD.score,OLD.confidence,OLD.release_status,OLD.explore_title_key,OLD.explore_year_suffix,OLD.explore_franchise_key,OLD.explore_developer_key,OLD.explore_publisher_key,OLD.explore_primary_safe,OLD.explore_early_access) IS NOT DISTINCT FROM ROW(NEW.id,NEW.slug,NEW.title,NEW.release_date,NEW.steam_app_id,NEW.review_count,NEW.platforms,NEW.genres,NEW.tags,NEW.created_at,NEW.current_players,NEW.verdict_score,NEW.score,NEW.confidence,NEW.release_status,NEW.explore_title_key,NEW.explore_year_suffix,NEW.explore_franchise_key,NEW.explore_developer_key,NEW.explore_publisher_key,NEW.explore_primary_safe,NEW.explore_early_access) THEN RETURN NEW; END IF;
 INSERT INTO public.explore_inputs(id,slug,title,release_date,steam_app_id,review_count,platforms,genres,tags,created_at,current_players,verdict_score,score,confidence,release_status,explore_title_key,explore_year_suffix,explore_franchise_key,explore_developer_key,explore_publisher_key,explore_primary_safe,explore_early_access) VALUES(NEW.id,NEW.slug,NEW.title,NEW.release_date,NEW.steam_app_id,NEW.review_count,NEW.platforms,NEW.genres,NEW.tags,NEW.created_at,NEW.current_players,NEW.verdict_score,NEW.score,NEW.confidence,NEW.release_status,NEW.explore_title_key,NEW.explore_year_suffix,NEW.explore_franchise_key,NEW.explore_developer_key,NEW.explore_publisher_key,NEW.explore_primary_safe,NEW.explore_early_access)
 ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,release_date=excluded.release_date,steam_app_id=excluded.steam_app_id,review_count=excluded.review_count,platforms=excluded.platforms,genres=excluded.genres,tags=excluded.tags,created_at=excluded.created_at,current_players=excluded.current_players,verdict_score=excluded.verdict_score,score=excluded.score,confidence=excluded.confidence,release_status=excluded.release_status,explore_title_key=excluded.explore_title_key,explore_year_suffix=excluded.explore_year_suffix,explore_franchise_key=excluded.explore_franchise_key,explore_developer_key=excluded.explore_developer_key,explore_publisher_key=excluded.explore_publisher_key,explore_primary_safe=excluded.explore_primary_safe,explore_early_access=excluded.explore_early_access;
 RETURN NEW;
END;
$maintain$;
REVOKE ALL ON FUNCTION public.refresh_explore_inputs() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER refresh_explore_inputs AFTER INSERT OR UPDATE ON public.games FOR EACH ROW EXECUTE FUNCTION public.refresh_explore_inputs();
CREATE INDEX games_explore_unclassified_idx ON public.games(id) WHERE explore_title_key IS NULL OR explore_year_suffix IS NULL OR explore_franchise_key IS NULL OR explore_developer_key IS NULL OR explore_publisher_key IS NULL OR explore_primary_safe IS NULL OR explore_early_access IS NULL;
CREATE OR REPLACE FUNCTION public.explore_catalogue_page(
  p_type text, p_year integer DEFAULT 0, p_genre text DEFAULT '',
  p_platform text DEFAULT '', p_sort text DEFAULT 'default',
  p_page integer DEFAULT 1, p_page_size integer DEFAULT 20,
  p_day date DEFAULT CURRENT_DATE
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = '' AS $function$
DECLARE selected_sort text;
BEGIN
  IF p_type NOT IN ('best-of-year','popular-in-year','all-time','recent','genre')
    OR p_sort NOT IN ('default','rating','popular','name-asc','name-desc','newest','oldest','added')
    OR p_page NOT BETWEEN 1 AND 250 OR p_page_size NOT BETWEEN 1 AND 40
    OR p_type = 'popular-in-year' AND (p_year IS NULL OR p_year NOT BETWEEN 1970 AND extract(year FROM CURRENT_DATE)::integer + 1)
    OR p_type = 'genre' AND (p_genre IS NULL OR p_genre NOT IN ('RPG','Action','Adventure','Shooter','Strategy','Simulation','Puzzle','Racing','Sports','Fighting','Platformer','Indie'))
    OR p_platform NOT IN ('','PC','PlayStation 5','PlayStation 4','Xbox Series X|S','Xbox One','Nintendo Switch','Android','iOS','Linux','macOS')
    OR p_type = 'all-time' AND p_sort <> 'default'
    OR p_type = 'best-of-year' AND p_sort IN ('rating','added')
    OR p_type IS NULL OR p_sort IS NULL OR p_page IS NULL OR p_page_size IS NULL
    OR p_platform IS NULL OR p_day IS NULL
  THEN RAISE EXCEPTION 'Invalid catalogue filters' USING ERRCODE = '22023'; END IF;
  selected_sort := CASE WHEN p_sort <> 'default' THEN p_sort
    WHEN p_type = 'recent' THEN 'newest'
    WHEN p_type IN ('best-of-year','genre') THEN 'popular' ELSE 'rating' END;
  IF NOT public.explore_source_unrestricted()
    OR NOT coalesce((SELECT ready FROM public.explore_input_state WHERE singleton),false) THEN
    -- Exact original source/RLS path while unavailable or caller-restricted.
    RETURN (
    WITH eligible AS MATERIALIZED (
      -- Carry only ranking/identity fields through sorts. Fetch card metadata
      -- after pagination, avoiding multi-megabyte sort rows and temp spills.
      SELECT g.id,g.slug,g.title,g.release_date,g.steam_app_id,g.review_count,g.platforms,g.created_at,
        coalesce(g.explore_title_key,regexp_replace(lower(regexp_replace(g.title, '\s*\((19|20)[0-9]{2}\)$', '')), '[^a-z0-9]', '', 'g')) AS canonical_title,
        coalesce(g.explore_year_suffix,g.title ~ '\s*\((19|20)[0-9]{2}\)$') AS year_suffix,
        coalesce(g.explore_franchise_key,regexp_replace(lower(coalesce(g.franchise,'')), '[^a-z0-9]', '', 'g')) AS franchise_key,
        coalesce(g.explore_developer_key,regexp_replace(lower(coalesce(g.developer,'')), '[^a-z0-9]', '', 'g')) AS developer_key,
        coalesce(g.explore_publisher_key,regexp_replace(lower(coalesce(g.publisher,'')), '[^a-z0-9]', '', 'g')) AS publisher_key,
        -- Match the decimal JSON values consumed by JS, rather than promoting
        -- binary float4 noise into float8 and breaking otherwise equal scores.
        CASE WHEN coalesce(g.verdict_score,0) > 0
          THEN g.verdict_score::text::double precision * (0.5 + coalesce(g.confidence,0)::text::double precision * 0.5)
            + 70::double precision * (0.5 - coalesce(g.confidence,0)::text::double precision * 0.5)
          ELSE (coalesce(g.score,0)::text::double precision * coalesce(g.review_count,0)::double precision + 75::double precision * 200)
            / (coalesce(g.review_count,0)::double precision + 200) END AS ranking_score,
        (CASE WHEN g.steam_app_id = 4465480 THEN 0 ELSE 1000 END
          + CASE WHEN g.steam_app_id = 730 THEN 4000 WHEN g.steam_app_id = 4465480 THEN -1000 ELSE 0 END
          + least(coalesce(g.current_players,0)::double precision / 1000,500)
          + coalesce(g.verdict_score,g.score,0)::text::double precision * 2
          + least(coalesce(g.review_count,0)::double precision / 1000,200)
          + coalesce(g.confidence,0)::text::double precision * 150
          + CASE WHEN g.release_date IS NULL THEN 0
            ELSE greatest(0,60-least(greatest(0,extract(epoch FROM (now() - (g.release_date::timestamp AT TIME ZONE 'UTC')))::double precision / 86400) / 30,60)) END
        ) AS representative_score
      FROM public.games g
      WHERE (
        p_type = 'best-of-year' AND (g.release_date > p_day
          OR g.release_status IN ('announced','coming_soon','upcoming','tba','early_access')
          OR g.tags @> ARRAY['Early Access'] OR g.tags @> ARRAY['early-access'] OR g.tags @> ARRAY['early access'])
        OR p_type <> 'best-of-year' AND g.release_date <= p_day
      )
      AND (p_type <> 'popular-in-year' OR g.release_date BETWEEN make_date(p_year,1,1) AND make_date(p_year,12,31))
      AND (p_type <> 'recent' OR g.release_date >= p_day - 30)
      AND (p_type <> 'genre' OR g.genres @> ARRAY[p_genre])
      AND (p_type NOT IN ('all-time','popular-in-year') OR g.review_count >= 100)
      AND coalesce(g.release_status,'') NOT IN ('cancelled','canceled','delisted')
      AND (p_type NOT IN ('all-time','popular-in-year','recent') OR (
        coalesce(g.release_status,'') NOT IN ('announced','coming_soon','upcoming','tba')
        AND NOT coalesce(g.explore_early_access,EXISTS (SELECT 1 FROM unnest(ARRAY[coalesce(g.release_status,'')] || coalesce(g.tags,'{}') || coalesce(g.genres,'{}')) tag WHERE replace(replace(lower(tag),'-',' '),'_',' ') = 'early access'))
      ))
      AND coalesce(g.explore_primary_safe,(lower(array_to_string(coalesce(g.tags,'{}') || coalesce(g.genres,'{}'), E'\n'))
        !~ '(sexual content|nsfw|hentai|adult|erotic|nudity|mature-content|sex|porn|mature|adult only|18\+)'
      AND lower(coalesce(g.description,'')) !~ '(sexual content|nsfw|hentai|erotic|adult-only|explicit sex)'
      AND lower(g.title) !~ '(game of the year edition|goty edition|complete edition|ultimate edition|definitive edition|enhanced edition|digital deluxe edition|deluxe edition|director''?s cut|anniversary edition)$'
      AND lower(g.title) !~ '(?<![a-z0-9_])(season pass|expansion pass|soundtrack|artbook|starter pack|bonus content|cosmetic pack)(?![a-z0-9_])'
      AND lower(coalesce(g.description,'')) !~ '(?<![a-z0-9_])(you must own the main game|this content requires|downloadable content|expansion pack|includes the following dlc|digital deluxe edition allows access|base game\s*\+\s*(digital deluxe|season pass|art book|soundtrack)|digital art book|extra bgm pack|season pass|second and final expansion|missing link in the main story|bonuses will be given to those who purchase|content can be downloaded from the store)(?![a-z0-9_])'))
    ), forced_titles AS (
      SELECT DISTINCT v.canonical_title FROM eligible v JOIN eligible b USING (canonical_title)
      WHERE v.year_suffix AND NOT b.year_suffix AND (
        v.franchise_key <> '' AND v.franchise_key = b.franchise_key
        OR v.developer_key <> '' AND v.developer_key = b.developer_key
        OR v.publisher_key <> '' AND v.publisher_key = b.publisher_key
        OR abs(v.release_date-b.release_date) <= 730)
    ), grouped AS (
      SELECT e.*, CASE
        WHEN e.steam_app_id IN (10,80,240,730,4465480) THEN 'special:counter-strike'
        WHEN e.year_suffix OR f.canonical_title IS NOT NULL OR e.steam_app_id IS NULL THEN 'title:' || e.canonical_title
        ELSE 'steam:' || e.steam_app_id::text END AS canonical_group
      FROM eligible e LEFT JOIN forced_titles f USING (canonical_title)
    ), representatives AS (
      SELECT g.*, row_number() OVER (PARTITION BY canonical_group ORDER BY representative_score DESC,id) AS representative_position
      FROM grouped g
    ), ranked AS (
      SELECT r.*, row_number() OVER (ORDER BY ranking_score DESC,slug COLLATE "en-US-x-icu") AS absolute_rank
      FROM representatives r WHERE representative_position = 1
        AND (p_type <> 'genre' OR selected_sort <> 'rating' OR review_count >= 100)
    ), filtered AS (
      SELECT * FROM ranked
      WHERE (p_type <> 'all-time' OR absolute_rank <= 250)
        AND (p_platform = '' OR p_platform = ANY(platforms)
          OR p_platform = 'Xbox Series X|S' AND 'Xbox Series S/X' = ANY(platforms))
    ), ordered AS (
      SELECT f.*, row_number() OVER (ORDER BY
        CASE WHEN selected_sort = 'name-asc' THEN title END COLLATE "en-US-x-icu" ASC,
        CASE WHEN selected_sort = 'name-desc' THEN title END COLLATE "en-US-x-icu" DESC,
        CASE WHEN selected_sort = 'rating' THEN ranking_score END DESC,
        CASE WHEN selected_sort = 'popular' THEN coalesce(review_count,0) END DESC,
        CASE WHEN selected_sort = 'newest' THEN release_date END DESC NULLS LAST,
        CASE WHEN selected_sort = 'oldest' THEN release_date END ASC NULLS LAST,
        CASE WHEN selected_sort = 'added' THEN created_at END DESC NULLS LAST,
        slug COLLATE "en-US-x-icu") AS position
      FROM filtered f
    ), page AS (
      SELECT * FROM ordered WHERE position > (p_page-1)*p_page_size AND position <= p_page*p_page_size
    )
    SELECT jsonb_build_object(
      'count',(SELECT count(*) FROM filtered),
      'fetchedAt',now(),
      'rows',coalesce(jsonb_agg(jsonb_build_object(
        'id',g.id,'rawg_id',g.rawg_id,'slug',g.slug,'title',g.title,'release_date',g.release_date,
        'release_status',g.release_status,'cover_image',g.cover_image,'header_image',g.header_image,
        'steam_app_id',g.steam_app_id,'score',g.score,'verdict_score',g.verdict_score,'confidence',g.confidence,
        'review_count',g.review_count,'platforms',g.platforms,'genres',g.genres,'tags',g.tags,'created_at',g.created_at,
        'ranking_score',p.ranking_score,'rank',CASE WHEN p_type='all-time' THEN p.absolute_rank ELSE NULL END
      ) ORDER BY p.position),'[]'::jsonb)
    ) FROM page p JOIN public.games g ON g.id=p.id
    );
  ELSE
    -- Compact live heap; no dependency on base-table visibility-map coverage.
    RETURN (
    WITH eligible AS MATERIALIZED (
      -- Carry only ranking/identity fields through sorts. Fetch card metadata
      -- after pagination, avoiding multi-megabyte sort rows and temp spills.
      SELECT g.id,g.slug,g.title,g.release_date,g.steam_app_id,g.review_count,g.platforms,g.created_at,
        g.explore_title_key AS canonical_title,
        g.explore_year_suffix AS year_suffix,
        g.explore_franchise_key AS franchise_key,
        g.explore_developer_key AS developer_key,
        g.explore_publisher_key AS publisher_key,
        -- Match the decimal JSON values consumed by JS, rather than promoting
        -- binary float4 noise into float8 and breaking otherwise equal scores.
        CASE WHEN coalesce(g.verdict_score,0) > 0
          THEN g.verdict_score::text::double precision * (0.5 + coalesce(g.confidence,0)::text::double precision * 0.5)
            + 70::double precision * (0.5 - coalesce(g.confidence,0)::text::double precision * 0.5)
          ELSE (coalesce(g.score,0)::text::double precision * coalesce(g.review_count,0)::double precision + 75::double precision * 200)
            / (coalesce(g.review_count,0)::double precision + 200) END AS ranking_score,
        (CASE WHEN g.steam_app_id = 4465480 THEN 0 ELSE 1000 END
          + CASE WHEN g.steam_app_id = 730 THEN 4000 WHEN g.steam_app_id = 4465480 THEN -1000 ELSE 0 END
          + least(coalesce(g.current_players,0)::double precision / 1000,500)
          + coalesce(g.verdict_score,g.score,0)::text::double precision * 2
          + least(coalesce(g.review_count,0)::double precision / 1000,200)
          + coalesce(g.confidence,0)::text::double precision * 150
          + CASE WHEN g.release_date IS NULL THEN 0
            ELSE greatest(0,60-least(greatest(0,extract(epoch FROM (now() - (g.release_date::timestamp AT TIME ZONE 'UTC')))::double precision / 86400) / 30,60)) END
        ) AS representative_score
      FROM public.explore_inputs g
      WHERE (
        p_type = 'best-of-year' AND (g.release_date > p_day
          OR g.release_status IN ('announced','coming_soon','upcoming','tba','early_access')
          OR g.tags @> ARRAY['Early Access'] OR g.tags @> ARRAY['early-access'] OR g.tags @> ARRAY['early access'])
        OR p_type <> 'best-of-year' AND g.release_date <= p_day
      )
      AND (p_type <> 'popular-in-year' OR g.release_date BETWEEN make_date(p_year,1,1) AND make_date(p_year,12,31))
      AND (p_type <> 'recent' OR g.release_date >= p_day - 30)
      AND (p_type <> 'genre' OR g.genres @> ARRAY[p_genre])
      AND (p_type NOT IN ('all-time','popular-in-year') OR g.review_count >= 100)
      AND coalesce(g.release_status,'') NOT IN ('cancelled','canceled','delisted')
      AND (p_type NOT IN ('all-time','popular-in-year','recent') OR (
        coalesce(g.release_status,'') NOT IN ('announced','coming_soon','upcoming','tba')
        AND NOT g.explore_early_access
      ))
      AND g.explore_primary_safe IS TRUE AND g.explore_title_key IS NOT NULL AND g.explore_year_suffix IS NOT NULL AND g.explore_franchise_key IS NOT NULL AND g.explore_developer_key IS NOT NULL AND g.explore_publisher_key IS NOT NULL AND g.explore_primary_safe IS NOT NULL AND g.explore_early_access IS NOT NULL
      UNION ALL
      -- Carry only ranking/identity fields through sorts. Fetch card metadata
      -- after pagination, avoiding multi-megabyte sort rows and temp spills.
      SELECT g.id,g.slug,g.title,g.release_date,g.steam_app_id,g.review_count,g.platforms,g.created_at,
        coalesce(g.explore_title_key,regexp_replace(lower(regexp_replace(g.title, '\s*\((19|20)[0-9]{2}\)$', '')), '[^a-z0-9]', '', 'g')) AS canonical_title,
        coalesce(g.explore_year_suffix,g.title ~ '\s*\((19|20)[0-9]{2}\)$') AS year_suffix,
        coalesce(g.explore_franchise_key,regexp_replace(lower(coalesce(g.franchise,'')), '[^a-z0-9]', '', 'g')) AS franchise_key,
        coalesce(g.explore_developer_key,regexp_replace(lower(coalesce(g.developer,'')), '[^a-z0-9]', '', 'g')) AS developer_key,
        coalesce(g.explore_publisher_key,regexp_replace(lower(coalesce(g.publisher,'')), '[^a-z0-9]', '', 'g')) AS publisher_key,
        -- Match the decimal JSON values consumed by JS, rather than promoting
        -- binary float4 noise into float8 and breaking otherwise equal scores.
        CASE WHEN coalesce(g.verdict_score,0) > 0
          THEN g.verdict_score::text::double precision * (0.5 + coalesce(g.confidence,0)::text::double precision * 0.5)
            + 70::double precision * (0.5 - coalesce(g.confidence,0)::text::double precision * 0.5)
          ELSE (coalesce(g.score,0)::text::double precision * coalesce(g.review_count,0)::double precision + 75::double precision * 200)
            / (coalesce(g.review_count,0)::double precision + 200) END AS ranking_score,
        (CASE WHEN g.steam_app_id = 4465480 THEN 0 ELSE 1000 END
          + CASE WHEN g.steam_app_id = 730 THEN 4000 WHEN g.steam_app_id = 4465480 THEN -1000 ELSE 0 END
          + least(coalesce(g.current_players,0)::double precision / 1000,500)
          + coalesce(g.verdict_score,g.score,0)::text::double precision * 2
          + least(coalesce(g.review_count,0)::double precision / 1000,200)
          + coalesce(g.confidence,0)::text::double precision * 150
          + CASE WHEN g.release_date IS NULL THEN 0
            ELSE greatest(0,60-least(greatest(0,extract(epoch FROM (now() - (g.release_date::timestamp AT TIME ZONE 'UTC')))::double precision / 86400) / 30,60)) END
        ) AS representative_score
      FROM public.games g
      WHERE (
        p_type = 'best-of-year' AND (g.release_date > p_day
          OR g.release_status IN ('announced','coming_soon','upcoming','tba','early_access')
          OR g.tags @> ARRAY['Early Access'] OR g.tags @> ARRAY['early-access'] OR g.tags @> ARRAY['early access'])
        OR p_type <> 'best-of-year' AND g.release_date <= p_day
      )
      AND (p_type <> 'popular-in-year' OR g.release_date BETWEEN make_date(p_year,1,1) AND make_date(p_year,12,31))
      AND (p_type <> 'recent' OR g.release_date >= p_day - 30)
      AND (p_type <> 'genre' OR g.genres @> ARRAY[p_genre])
      AND (p_type NOT IN ('all-time','popular-in-year') OR g.review_count >= 100)
      AND coalesce(g.release_status,'') NOT IN ('cancelled','canceled','delisted')
      AND (p_type NOT IN ('all-time','popular-in-year','recent') OR (
        coalesce(g.release_status,'') NOT IN ('announced','coming_soon','upcoming','tba')
        AND NOT coalesce(g.explore_early_access,EXISTS (SELECT 1 FROM unnest(ARRAY[coalesce(g.release_status,'')] || coalesce(g.tags,'{}') || coalesce(g.genres,'{}')) tag WHERE replace(replace(lower(tag),'-',' '),'_',' ') = 'early access'))
      ))
      AND coalesce(g.explore_primary_safe,(lower(array_to_string(coalesce(g.tags,'{}') || coalesce(g.genres,'{}'), E'\n'))
        !~ '(sexual content|nsfw|hentai|adult|erotic|nudity|mature-content|sex|porn|mature|adult only|18\+)'
      AND lower(coalesce(g.description,'')) !~ '(sexual content|nsfw|hentai|erotic|adult-only|explicit sex)'
      AND lower(g.title) !~ '(game of the year edition|goty edition|complete edition|ultimate edition|definitive edition|enhanced edition|digital deluxe edition|deluxe edition|director''?s cut|anniversary edition)$'
      AND lower(g.title) !~ '(?<![a-z0-9_])(season pass|expansion pass|soundtrack|artbook|starter pack|bonus content|cosmetic pack)(?![a-z0-9_])'
      AND lower(coalesce(g.description,'')) !~ '(?<![a-z0-9_])(you must own the main game|this content requires|downloadable content|expansion pack|includes the following dlc|digital deluxe edition allows access|base game\s*\+\s*(digital deluxe|season pass|art book|soundtrack)|digital art book|extra bgm pack|season pass|second and final expansion|missing link in the main story|bonuses will be given to those who purchase|content can be downloaded from the store)(?![a-z0-9_])'))
      AND (g.explore_title_key IS NULL OR g.explore_year_suffix IS NULL OR g.explore_franchise_key IS NULL OR g.explore_developer_key IS NULL OR g.explore_publisher_key IS NULL OR g.explore_primary_safe IS NULL OR g.explore_early_access IS NULL)
    ), forced_titles AS (
      SELECT DISTINCT v.canonical_title FROM eligible v JOIN eligible b USING (canonical_title)
      WHERE v.year_suffix AND NOT b.year_suffix AND (
        v.franchise_key <> '' AND v.franchise_key = b.franchise_key
        OR v.developer_key <> '' AND v.developer_key = b.developer_key
        OR v.publisher_key <> '' AND v.publisher_key = b.publisher_key
        OR abs(v.release_date-b.release_date) <= 730)
    ), grouped AS (
      SELECT e.*, CASE
        WHEN e.steam_app_id IN (10,80,240,730,4465480) THEN 'special:counter-strike'
        WHEN e.year_suffix OR f.canonical_title IS NOT NULL OR e.steam_app_id IS NULL THEN 'title:' || e.canonical_title
        ELSE 'steam:' || e.steam_app_id::text END AS canonical_group
      FROM eligible e LEFT JOIN forced_titles f USING (canonical_title)
    ), representatives AS (
      SELECT g.*, row_number() OVER (PARTITION BY canonical_group ORDER BY representative_score DESC,id) AS representative_position
      FROM grouped g
    ), ranked AS (
      SELECT r.*, row_number() OVER (ORDER BY ranking_score DESC,slug COLLATE "en-US-x-icu") AS absolute_rank
      FROM representatives r WHERE representative_position = 1
        AND (p_type <> 'genre' OR selected_sort <> 'rating' OR review_count >= 100)
    ), filtered AS (
      SELECT * FROM ranked
      WHERE (p_type <> 'all-time' OR absolute_rank <= 250)
        AND (p_platform = '' OR p_platform = ANY(platforms)
          OR p_platform = 'Xbox Series X|S' AND 'Xbox Series S/X' = ANY(platforms))
    ), ordered AS (
      SELECT f.*, row_number() OVER (ORDER BY
        CASE WHEN selected_sort = 'name-asc' THEN title END COLLATE "en-US-x-icu" ASC,
        CASE WHEN selected_sort = 'name-desc' THEN title END COLLATE "en-US-x-icu" DESC,
        CASE WHEN selected_sort = 'rating' THEN ranking_score END DESC,
        CASE WHEN selected_sort = 'popular' THEN coalesce(review_count,0) END DESC,
        CASE WHEN selected_sort = 'newest' THEN release_date END DESC NULLS LAST,
        CASE WHEN selected_sort = 'oldest' THEN release_date END ASC NULLS LAST,
        CASE WHEN selected_sort = 'added' THEN created_at END DESC NULLS LAST,
        slug COLLATE "en-US-x-icu") AS position
      FROM filtered f
    ), page AS (
      SELECT * FROM ordered WHERE position > (p_page-1)*p_page_size AND position <= p_page*p_page_size
    )
    SELECT jsonb_build_object(
      'count',(SELECT count(*) FROM filtered),
      'fetchedAt',now(),
      'rows',coalesce(jsonb_agg(jsonb_build_object(
        'id',g.id,'rawg_id',g.rawg_id,'slug',g.slug,'title',g.title,'release_date',g.release_date,
        'release_status',g.release_status,'cover_image',g.cover_image,'header_image',g.header_image,
        'steam_app_id',g.steam_app_id,'score',g.score,'verdict_score',g.verdict_score,'confidence',g.confidence,
        'review_count',g.review_count,'platforms',g.platforms,'genres',g.genres,'tags',g.tags,'created_at',g.created_at,
        'ranking_score',p.ranking_score,'rank',CASE WHEN p_type='all-time' THEN p.absolute_rank ELSE NULL END
      ) ORDER BY p.position),'[]'::jsonb)
    ) FROM page p JOIN public.games g ON g.id=p.id
    );
  END IF;
END;
$function$;
COMMIT;
