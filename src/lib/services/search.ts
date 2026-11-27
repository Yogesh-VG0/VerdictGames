import { getUpcomingMetadataScore, projectBrowseCard, projectReviewedRelease, rankCatalogueCohort } from "@/lib/services/catalogue-discovery-ranking";
import { unstable_cache } from "next/cache";
import { expandGameSearchAlias, searchGamesStateToFilters, type SearchGamesState } from "@/lib/search";
import { GAME_CARD_COLUMNS_WITH_DESC } from "@/lib/db/columns";
import { mapGameRow } from "@/lib/db/mappers";
import { getPublicSupabase, hasPublicSupabaseEnv } from "@/lib/supabase/public";
import type { Game, PaginatedResponse, Platform } from "@/lib/types";
import type { GameRow } from "@/lib/supabase/types";
import { isPrimaryDiscoveryGame } from "@/lib/utils/discovery";
import { getPlayerGrowthEvidence } from "@/lib/utils/trending";
import { isPublicSafeGame, isPublicSafeRawgGame } from "@/lib/utils/publicSafety";
import { normalizeTitle } from "@/lib/utils/slugify";
import { isFutureDate } from "@/lib/utils";
import {searchGenrePredicate} from '@/lib/utils/searchGenre';
import { hasUnavailableStatus } from "@/lib/utils/release-status";
import { reviewedCatalogueReleases, reviewedPendingCatalogueReleases } from './reviewed-catalogue-releases';

export { getBrowseTopRatedScore, isBrowseTopRatedEligible } from "@/lib/services/catalogue-discovery-ranking";

export const SEARCH_REVALIDATE_SECONDS = 300;
export const SEARCH_API_CACHE_CONTROL = `s-maxage=${SEARCH_REVALIDATE_SECONDS}, stale-while-revalidate=300`;
export const SEARCH_PAGE_SIZE = 25;
const SEARCH_RESULTS_CACHE_NAMESPACE = "search-results-v17";
const BOUNDED_BROWSE_NOTICE = "Results are from a bounded catalogue selection. Use filters to narrow the search.";
const TRENDING_NOTICE = "Trending Up uses player growth observed in the last 24 hours. Past Momentum uses older observations, up to seven days. Games without qualifying growth are excluded.";
// Ranking and eligibility need evidence and safety metadata, not display copy,
// prices or hero flags. Hydrate full card fields only for the visible page.
const BROWSE_POOL_COLUMNS = GAME_CARD_COLUMNS_WITH_DESC.split(',').filter(column => ![
  'subtitle', 'header_image', 'verdict_summary', 'price_current', 'price_currency',
  'price_deal_url', 'price_lowest', 'featured', 'is_featured_manual',
  'steam_rating_label', 'updated_at',
].includes(column)).join(',');
// Recently Added needs no description-length quality gate. The existing
// maintained classifier contains the same public-safety/primary-game checks.
// Keep the original source cohort and ranking inputs; load display fields only
// for a visible page. NULL classifications take the original full-row path.
const RECENT_POOL_COLUMNS = [
  'id','title','cover_image','release_date','created_at','steam_app_id',
  'review_count','steam_total_count','rawg_rating','score_source','user_score',
  'score','verdict_score','confidence','current_players','players_updated_at','is_provisional',
  'verdict_label','release_status','developer','publisher','explore_primary_safe',
].join(',');
// The unfiltered Relevance cohort only needs ranking inputs and canonical
// identity. Read display copy for visible cards and classifier-null rows.
const RELEVANCE_POOL_COLUMNS = RECENT_POOL_COLUMNS + ',franchise,momentum';
const UPCOMING_POOL_COLUMNS = [
  'id','slug','title','cover_image','header_image','platforms','genres','tags','developer','publisher','franchise',
  'release_date','release_status','monetization','rawg_id','igdb_id','steam_app_id','score','verdict_score',
  'confidence','review_count','current_players','explore_primary_safe',
].join(',');
const NEWEST_EVIDENCE_COLUMNS = ',rawg_id,igdb_id';

export function createEmptySearchResult(page: number): PaginatedResponse<Game> {
  return {
    items: [],
    total: 0,
    page,
    pageSize: SEARCH_PAGE_SIZE,
    hasMore: false,
    totalIsExact: true,
  };
}

// Resolve filters once, then reuse them for the narrow cohort and bounded reads.
// A wrapped builder avoids accidentally executing its Promise-like query here.
function createSearchQueryFactory(state: SearchGamesState) {
  const {query:q, platform, genre, year, monetization, sort} = state;
  const supabase = getPublicSupabase();
  let mobileIds: Promise<string[]> | undefined;
  const today = new Date().toISOString().slice(0, 10);
  const recentlyAddedReleaseCutoff = new Date();
  recentlyAddedReleaseCutoff.setUTCFullYear(recentlyAddedReleaseCutoff.getUTCFullYear() - 5);
  const recentlyAddedReleaseCutoffStr = recentlyAddedReleaseCutoff.toISOString().slice(0, 10);
  return async (columns: string, signal: AbortSignal, ids?: string[]) => {
    let query = supabase.from("games").select(columns);
    if (!q) query = query.or("explore_primary_safe.eq.true,explore_primary_safe.is.null");

    let scopedIds = ids;

    if (q) {
      const currentCounterStrike = q.toLowerCase() === 'counter strike 2' ? ',steam_app_id.eq.730,title.ilike.%Counter-Strike 2%' : '';
      query = query.or(`title.ilike.%${q}%,developer.ilike.%${q}%,publisher.ilike.%${q}%${currentCounterStrike}`);
    }

    if (platform && platform !== "All") {
      const platformFamilies: Record<string, string[]> = {
        "PlayStation 5": ["PlayStation 5", "PlayStation 4"],
        "Xbox Series X|S": ["Xbox Series X|S", "Xbox One"],
        "Nintendo Switch": ["Nintendo Switch", "Nintendo Switch 2"],
      };
      const platformAliases: Record<string, string> = {
        playstation: "PlayStation 5",
        ps5: "PlayStation 5",
        ps4: "PlayStation 5",
        xbox: "Xbox Series X|S",
        switch: "Nintendo Switch",
        mac: "macOS",
        macos: "macOS",
      };
      const resolvedPlatform = platformAliases[platform.toLowerCase()] ?? platform;
      const mobileStoreMap: Record<string, string> = {
        Android: "google_play",
        iOS: "app_store",
      };
      const storeName = mobileStoreMap[resolvedPlatform];

      if (storeName) {
        mobileIds ??= (async () => {
          const { data: verifiedIds, error } = await supabase
            .from("mobile_store_listings")
            .select("game_id")
            .eq("store", storeName)
            .eq("is_verified", true).abortSignal(signal);
          if (error) throw error;
          return (verifiedIds ?? []).map((row: {game_id:string}) => row.game_id);
        })();
        const verifiedIds = await mobileIds;

        if (verifiedIds.length > 0) {
          const verifiedSet = new Set(verifiedIds);
          scopedIds = ids ? ids.filter(id => verifiedSet.has(id)) : verifiedIds;
        } else {
          query = query.contains("platforms", [resolvedPlatform]);
        }
      } else {
        const family = platformFamilies[resolvedPlatform];
        if (family) {
          query = query.or(family.map((candidate) => `platforms.cs.{${candidate}}`).join(","));
        } else {
          query = query.contains("platforms", [resolvedPlatform]);
        }
      }
    }

    if (genre) {
      query = query.or(searchGenrePredicate(genre));
    }

    if (year) {
      query = query.gte("release_date", `${year}-01-01`).lte("release_date", `${year}-12-31`);
    }

    if (monetization && monetization !== "All") {
      query = query.eq("monetization", monetization);
    }

    switch (sort) {
      case "newest":
        query = query
          .lte("release_date", today)
          .or(`release_status.in.(released,"full release",full_release,full-release),slug.in.(${reviewedCatalogueReleases.map(game=>game.slug).join(',')})`)
          .not("cover_image", "is", null)
          .neq("cover_image", "")
          .order("release_date", { ascending: false })
          .order("id", { ascending: true });
        break;
      case "upcoming":
        query = query
          .or(`release_date.gt.${today},release_status.in.(upcoming,unreleased,announced,coming_soon,coming-soon,tba,early_access,early-access),explore_early_access.eq.true,slug.in.(${reviewedPendingCatalogueReleases.map(game=>game.slug).join(',')})`)
          .not("cover_image", "is", null)
          .neq("cover_image", "")
          .order("release_date", { ascending: true })
          .order("id", { ascending: true });
        break;
      case "recently-added":
        query = query
          .not("release_date", "is", null)
          .gte("release_date", recentlyAddedReleaseCutoffStr)
          .lte("release_date", today)
          .not("cover_image", "is", null)
          .neq("cover_image", "")
          .gt("score", 0)
          .or("is_provisional.is.null,is_provisional.eq.false")
          .neq("verdict_label", "COMING SOON")
          .order("created_at", { ascending: false })
          .order("id", { ascending: true });
        break;
      case "top-rated":
        query = query
          .not("cover_image", "is", null)
          .neq("cover_image", "")
          .order("verdict_score", { ascending: false, nullsFirst: false })
          .order("confidence", { ascending: false, nullsFirst: false })
          .order("score", { ascending: false })
          .order("id", { ascending: true });
        break;
      case "trending":
        query = query
          .not("cover_image", "is", null)
          .neq("cover_image", "")
          .not("players_updated_at", "is", null)
          .gte("players_updated_at", new Date(Date.now() - 7 * 86400000).toISOString())
          .gte("current_players", 100)
          .gte("momentum", 0.0399)
          .order("is_trending_manual", { ascending: false, nullsFirst: false })
          .order("trending", { ascending: false, nullsFirst: false })
          .order("current_players", { ascending: false, nullsFirst: false })
          .order("momentum", { ascending: false, nullsFirst: false })
          .order("verdict_score", { ascending: false, nullsFirst: false })
          .order("review_count", { ascending: false, nullsFirst: false })
          .order("id", { ascending: true });
        break;
      default:
        if (q) {
          query = query
            .order("verdict_score", { ascending: false, nullsFirst: false })
            .order("score", { ascending: false })
            .order("id", { ascending: true });
        } else {
          query = query
            .gte("review_count", 10)
            .gte("score", 55)
            .not("cover_image", "is", null)
            .neq("cover_image", "")
            .order("trending", { ascending: false, nullsFirst: false })
            .order("verdict_score", { ascending: false, nullsFirst: false })
            .order("release_date", { ascending: false })
            .order("id", { ascending: true });
        }
        break;
    }

    if (scopedIds) query = query.in('id', scopedIds);
    return {query};
  };
}

async function hydrateBrowseCohort(
  createQuery: ReturnType<typeof createSearchQueryFactory>,
  ids: string[], columns: string, signal: AbortSignal,
): Promise<GameRow[]> {
  const rows = new Map<string, GameRow>();
  let cursor = 0;
  const worker = async () => {
    while (cursor < ids.length) {
      signal.throwIfAborted();
      const batch = ids.slice(cursor, cursor += 200);
      const {query} = await createQuery(columns, signal, batch);
      const started = performance.now();
      const {data, error} = await query.abortSignal(signal) as unknown as {data:GameRow[]|null; error:unknown};
      if (error) {
        console.warn('[Search] cohort hydration failed', {rows:batch.length, ms:Math.round(performance.now()-started), deadlineExpired:signal.aborted});
        throw error;
      }
      for (const row of data ?? []) rows.set(row.id, row);
    }
  };
  await Promise.all([worker(), worker()]);
  return ids.flatMap(id => rows.has(id) ? [rows.get(id)!] : []);
}

interface RankedBrowsePool { ids:string[]; totalIsExact:boolean; cards?:Game[]; observedAt?:number }
function browseNotice(sort: SearchGamesState['sort'], totalIsExact: boolean) {
  const notes = [sort === 'trending' ? TRENDING_NOTICE : '', !totalIsExact ? BOUNDED_BROWSE_NOTICE : ''].filter(Boolean);
  return notes.length ? { notice: notes.join(' ') } : {};
}
async function fetchSearchResults(state:SearchGamesState,poolOnly:true):Promise<RankedBrowsePool>;
async function fetchSearchResults(state:SearchGamesState,poolOnly?:false):Promise<PaginatedResponse<Game>>;
async function fetchSearchResults(state: SearchGamesState,poolOnly=false): Promise<PaginatedResponse<Game>|RankedBrowsePool> {
  const { query: q, platform, genre, year, monetization, sort, page } = state;

  if (!hasPublicSupabaseEnv()) {
    return poolOnly?{ids:[],totalIsExact:true}:createEmptySearchResult(page);
  }

  if(!poolOnly && !q && platform==='All' && !genre && !year && monetization==='All') {
    const pool=await readRankedBrowsePool(sort);
    if (sort === "trending" && (pool.observedAt == null || Date.now() - pool.observedAt > 2 * SEARCH_REVALIDATE_SECONDS * 1000)) {
      throw new Error("Trending catalogue snapshot expired.");
    }
    const ids=pool.ids.slice((page-1)*SEARCH_PAGE_SIZE,page*SEARCH_PAGE_SIZE);
    const projection = sort==='newest' || sort==='trending' ? sort : undefined;
    const cards=ids.length?await (page<=3?readCachedBrowseCards:readBrowseCards)(ids,projection):[];
    const games=new Map(cards.map(game=>[game.id,game]));
    const totalIsExact=pool.totalIsExact && cards.length===ids.length;
    return {items:ids.flatMap(id=>games.has(id)?[games.get(id)!]:[]),total:pool.ids.length,page,pageSize:SEARCH_PAGE_SIZE,
      hasMore:page*SEARCH_PAGE_SIZE<pool.ids.length,totalIsExact,...browseNotice(sort,totalIsExact)};
  }

  const isRelevanceWithQuery = sort === "relevance" && Boolean(q);
  const isTopRated = sort === "top-rated";
  const isTrendingSort = sort === "trending";
  const isNewest = sort === "newest";
  const isUpcoming = sort === "upcoming";
  const isRecentlyAdded = sort === "recently-added";
  const compactRecentPool = poolOnly && isRecentlyAdded;
  const compactRelevancePool = poolOnly && sort === 'relevance' && !q;
  const usesStoredClassification = compactRecentPool || compactRelevancePool || isUpcoming;
  const start = (page - 1) * SEARCH_PAGE_SIZE;
  // Rank a stable finite cohort before pagination. Growing the pool with page
  // number promoted later candidates into earlier pages and repeated games.
  // Preserve the original first-page query budgets instead of widening every
  // cold sort to 1,000 rows. The same cohort is reused for every page.
  const requestedLimit = compactRelevancePool ? 300 : isRelevanceWithQuery ? 150
    : isRecentlyAdded ? 1000 : isTrendingSort ? 750
      : isTopRated || isNewest || isUpcoming ? 500 : 150;
  const boundedCohort = requestedLimit > 200 && !compactRelevancePool && !isUpcoming;
  const createQuery = createSearchQueryFactory(state);
  const controller = new AbortController();
  const signal = AbortSignal.any([AbortSignal.timeout(10_000), controller.signal]);
  const columns = compactRecentPool ? RECENT_POOL_COLUMNS : compactRelevancePool ? RELEVANCE_POOL_COLUMNS
    : isUpcoming ? UPCOMING_POOL_COLUMNS
    : (poolOnly ? BROWSE_POOL_COLUMNS : GAME_CARD_COLUMNS_WITH_DESC) + (isNewest ? NEWEST_EVIDENCE_COLUMNS : '');
  let data: GameRow[] | null;
  let returnedCount: number;
  let phase = 'initial-query';
  const started = performance.now();
  try {
    const {query} = await createQuery(boundedCohort ? 'id' : columns, signal);
    const result = await query.range(0, requestedLimit - 1).abortSignal(signal) as unknown as {data:GameRow[]|null; error:unknown};
    if (result.error) throw result.error;
    returnedCount = result.data?.length ?? 0;
    // Keep exactly the original candidate boundary and initial ordering.
    // No partial response is cached when a chunk fails or the shared deadline expires.
    phase = 'hydrate';
    data = boundedCohort
      ? await hydrateBrowseCohort(createQuery, (result.data ?? []).map(row => row.id), columns, signal)
      : result.data;
    if (usesStoredClassification) {
      const unclassified=(data || []).filter(row=>{
        const classifier=(row as GameRow & {explore_primary_safe?:boolean|null}).explore_primary_safe;
        return typeof classifier!=='boolean' || isUpcoming && classifier && getUpcomingMetadataScore(row)<2;
      }).map(row=>row.id);
      if(unclassified.length){
        phase='classification-fallback';
        const fullRows=await hydrateBrowseCohort(createQuery,unclassified,isUpcoming?'id,description':BROWSE_POOL_COLUMNS,signal);
        const byId=new Map(fullRows.map(row=>[row.id,row]));
        const missing=new Set(unclassified);
        data=(data || []).flatMap(row=>missing.has(row.id)?byId.has(row.id)?[{...row,...byId.get(row.id)!}]:[]:[row]);
      }
    }
  } catch (error) {
    console.warn('[Search] catalogue read failed', {sort, phase, ms:Math.round(performance.now()-started), deadlineExpired:signal.aborted});
    controller.abort();
    throw error;
  }
  let totalIsExact = returnedCount < requestedLimit && (data?.length ?? 0) === returnedCount;

  const observedNow = Date.now();
  let rows = rankCatalogueCohort(data ?? [], state, usesStoredClassification, observedNow);
  const filteredTotal = rows.length;

  if (poolOnly) return {
    ids: rows.map(row => row.id), totalIsExact,
    ...(isTrendingSort ? { observedAt: observedNow } : {}),
    ...(isUpcoming ? { cards: rows.map(row => projectBrowseCard(row, sort, observedNow)) } : {}),
  };
  rows = rows.slice(start, start + SEARCH_PAGE_SIZE);
  const games = rows.map(row => projectBrowseCard(row, sort, observedNow));
   let total = filteredTotal;

  const noFilters = platform === "All" && !genre && !year && monetization === "All";
  const allowPreviewFallback = sort === "relevance" && q.length >= 2 && page === 1 && noFilters;
  if (total === 0 && allowPreviewFallback) {
    try {
      const { searchRawg, mapRawgPlatforms } = await import("@/lib/external/rawg");
      const rawgResults = await searchRawg(q, 1, 5);
      const existingSlugs = new Set(games.map((game) => normalizeTitle(game.title)));

      if (rawgResults.results.length > 0) {
        for (const rawgGame of rawgResults.results) {
          if (!isPublicSafeRawgGame(rawgGame) || !isPrimaryDiscoveryGame({title:rawgGame.name,description:''})) continue;
          if (existingSlugs.has(normalizeTitle(rawgGame.name))) {
            continue;
          }

          const upcoming=!rawgGame.released || isFutureDate(rawgGame.released);
          games.push({
            id: `rawg-${rawgGame.id}`,
            rawgId: rawgGame.id,
            slug: rawgGame.slug,
            title: rawgGame.name,
            coverImage: rawgGame.background_image ?? "",
            headerImage: rawgGame.background_image ?? "",
            screenshots: (rawgGame.short_screenshots ?? []).map((s) => s.image),
            platforms: mapRawgPlatforms(rawgGame.platforms) as Platform[],
            genres: (rawgGame.genres ?? []).map((g) => g.name),
            tags: (rawgGame.tags ?? []).slice(0, 6).map((t) => t.name),
            developer: "",
            publisher: "",
            releaseDate: rawgGame.released ?? "",
            description: "",
            score: upcoming ? 0 : rawgGame.metacritic ?? Math.round((rawgGame.rating || 0) * 20),
            verdictLabel: upcoming ? 'COMING SOON' :
              rawgGame.metacritic && rawgGame.metacritic >= 80
                ? "MUST PLAY"
                : rawgGame.metacritic && rawgGame.metacritic >= 65
                  ? "WORTH IT"
                  : "MIXED",
            verdictSummary: "",
            pros: [],
            cons: [],
            monetization: "Paid",
            performanceNotes: "",
            monetizationNotes: "",
            reviewCount: rawgGame.ratings_count ?? 0,
            rawgRating: rawgGame.rating,
            rawgMetacritic: rawgGame.metacritic ?? undefined,
            scoreSource:'rawg',isPreview:true,previewSource:'rawg',isProvisional:upcoming,
            releaseStatus:upcoming?'upcoming':undefined,
            subtitle: "",
          });
          existingSlugs.add(normalizeTitle(rawgGame.name));
        }

        total = games.length;
        totalIsExact = false;
      }
    } catch (error) {
      console.warn("[search-service] RAWG preview fallback failed:", error);
    }
  }

  return {
    items: games,
    total,
    page,
    pageSize: SEARCH_PAGE_SIZE,
    hasMore: start + SEARCH_PAGE_SIZE < total,
    totalIsExact,
    ...browseNotice(sort,totalIsExact),
  };
}

// Only six unfiltered public discovery cohorts enter this shared cache.
// Store IDs (~40KB maximum), never the 1,000 wide source rows. Warm pages read
// only their 25 card records; personalized data never enters this path.
// Next can start multiple background revalidations of the same stale entry.
// Share their work within a function worker; retain only the six allowed sorts
// while a read is pending, and always remove failed or completed reads.
const pendingBrowsePools = new Map<SearchGamesState['sort'], Promise<RankedBrowsePool>>();
function readSharedBrowsePool(sort: SearchGamesState['sort']): Promise<RankedBrowsePool> {
  const pending = pendingBrowsePools.get(sort);
  if (pending) return pending;
  const read = fetchSearchResults({query:'',platform:'All',genre:'',year:'',monetization:'All',sort,page:1},true)
    .finally(() => {pendingBrowsePools.delete(sort);});
  pendingBrowsePools.set(sort, read);
  return read;
}
const readRankedBrowsePool=unstable_cache(async(sort:SearchGamesState['sort'])=>{
  if(!['relevance','newest','upcoming','recently-added','top-rated','trending'].includes(sort))throw new Error('Invalid public browse sort');
  return readSharedBrowsePool(sort);
},['public-browse-ranked-ids-v14'],{revalidate:SEARCH_REVALIDATE_SECONDS,tags:['public-search']});

async function readBrowseCards(ids:string[], projection?:'newest'|'trending'):Promise<Game[]> {
  const columns = GAME_CARD_COLUMNS_WITH_DESC + (projection==='newest' ? NEWEST_EVIDENCE_COLUMNS : '');
  const {data,error}=await getPublicSupabase().from('games').select(columns).in('id',ids).abortSignal(AbortSignal.timeout(5000));
  if(error)throw error;
  const rows=((data || []) as unknown as GameRow[]).filter(row => isPublicSafeGame(row) && !hasUnavailableStatus(row));
  if (projection!=='trending') return rows.map(row=>mapGameRow(projection==='newest'?projectReviewedRelease(row):row));
  const now=Date.now();
  return rows.flatMap(row=>{
    const growth=getPlayerGrowthEvidence(row,now);
    return growth?[{...mapGameRow(row),trendingReason:growth==='fresh'?'Trending Up':'Past Momentum'}]:[];
  });
}
const readCachedBrowseCards=unstable_cache(readBrowseCards,['public-browse-cards-v3'],{revalidate:SEARCH_REVALIDATE_SECONDS,tags:['public-search']});

export async function loadSearchResults(state: SearchGamesState): Promise<PaginatedResponse<Game>> {
  const expandedQuery = expandGameSearchAlias(state.query);
  if (expandedQuery !== state.query) state = { ...state, query: expandedQuery };
  if(state.sort==='upcoming'){
    const {loadUpcomingSearch}=await import('./upcoming-search');
    const scoped = state.query || state.platform !== 'All' || state.genre || state.year || state.monetization !== 'All';
    return loadUpcomingSearch(state, scoped ? fetchSearchResults(state, true) : readRankedBrowsePool('upcoming'));
  }
  // Next bypasses nested unstable_cache reads. Keep the cohort and small-card
  // caches outside the per-filter response cache, or every page rescans1,000 rows.
  if(!state.query && state.platform==='All' && !state.genre && !state.year && state.monetization==='All')return fetchSearchResults(state);
  const cacheKey = JSON.stringify(searchGamesStateToFilters(state));
  return unstable_cache(
    () => fetchSearchResults(state),
    [SEARCH_RESULTS_CACHE_NAMESPACE, cacheKey],
    { revalidate: SEARCH_REVALIDATE_SECONDS }
  )();
}
