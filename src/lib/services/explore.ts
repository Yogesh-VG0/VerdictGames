import { unstable_cache } from 'next/cache';
import { getPublicSupabase } from '@/lib/supabase/public';
import { isPublicSafeGame, isPublicSafeRawgGame } from '@/lib/utils/publicSafety';
import { readUpcomingSnapshot as readUpcoming, readCalendarUpcomingSnapshot } from '@/lib/services/upcoming-snapshot';
import { selectCatalogueArtwork } from '@/lib/utils/artwork';
import { matchReviewedCatalogueRelease } from './reviewed-catalogue-releases';
import { reviewedUpcomingArtwork } from '@/lib/utils/reviewed-upcoming-artwork';
import { EXPLORE_GENRES } from '@/lib/utils/explore-filters';
import { normalizeTitle } from '@/lib/utils/slugify';
import { boundedHomepageRead, homepageSignal } from '@/lib/services/homepage-budget';
import { isPrimaryDiscoveryGame } from '@/lib/utils/discovery';
import { dedupePublicCanonicalRows } from '@/lib/utils/publicCanonical';
import { confidenceWeightedScore } from '@/lib/utils/quality';
import { hasEarlyAccessSignal, hasKnownFullRelease } from '@/lib/utils/release-status';
import { getReviewedReleaseTiming, readReleaseTimings } from '@/lib/services/release-timing';
import { compareUpcomingTiming, formatReleaseTiming, releaseTimingMonth, resolveReleaseTiming } from '@/lib/utils/release-timing';
import { readCataloguePage } from '@/lib/services/explore-query';
import { loadProviderRanking } from '@/lib/services/provider-explore';
import type { GameRow } from '@/lib/supabase/types';
import type { Game } from '@/lib/types';
import type { RawgListResponse, RawgListType, RawgListGameItem, ExploreSort } from '@/lib/api';

const columns = 'id,rawg_id,slug,title,release_date,release_status,cover_image,header_image,steam_app_id,score,verdict_score,confidence,review_count,current_players,platforms,genres,tags,description,franchise,developer,publisher,created_at';

const readUpcomingMatches = unstable_cache(async (ids:number[]) => {
  if (!ids.length) return [];
  const {data,error} = await getPublicSupabase().from('games')
    .select('id,rawg_id,igdb_id,slug,title,description,cover_image,header_image,steam_app_id,is_featured_manual,tags,genres,release_status,release_date,monetization')
    .in('rawg_id',ids).abortSignal(homepageSignal(AbortSignal.timeout(1800)));
  if (error) throw error;
  return data || [];
}, ['upcoming-public-matches-v3'], {revalidate:300,tags:['public-explore']});
// A failure throws so Next retains its last good snapshot on revalidation.

// Small independently cached chunks stay below Next's 2MB cache-entry limit.
// Descriptions are used for safety/edition checks, then excluded from the cache.
const readCatalogueChunk = unstable_cache(async (type: RawgListType, year: number, genre: string, day: string, offset: number) => {
  const since = new Date(`${day}T00:00:00Z`); since.setUTCDate(since.getUTCDate() - 30);
    let query = getPublicSupabase().from('games').select(columns);
    if (type === 'best-of-year') query = query.or(`release_date.gt.${day},release_status.in.(announced,coming_soon,upcoming,tba,early_access),tags.cs.{"Early Access"},tags.cs.{"early-access"},tags.cs.{"early access"}`);
    else query = query.lte('release_date', day);
    if (type === 'popular-in-year') query = query.gte('release_date', `${year}-01-01`).lte('release_date', `${year}-12-31`);
    if (type === 'recent') query = query.gte('release_date', since.toISOString().slice(0, 10));
    if (type === 'genre') query = query.contains('genres', [EXPLORE_GENRES[genre]]);
    if (type === 'all-time' || type === 'popular-in-year') query = query.gte('review_count', 100);
    const { data, error } = await query.order('id').range(offset, offset + 249).abortSignal(AbortSignal.timeout(5000));
    if (error) throw error;
    const rows = (data || []) as unknown as GameRow[];
    return { complete: rows.length < 250, rows: rows.filter(row => isPublicSafeGame(row) && isPrimaryDiscoveryGame(row)
      && (type !== 'best-of-year' || !hasKnownFullRelease(row))
      && !['cancelled', 'canceled', 'delisted'].includes(row.release_status || '')
      && (!['all-time','popular-in-year','recent'].includes(type) || !hasEarlyAccessSignal(row) && !['announced','coming_soon','upcoming','tba'].includes(row.release_status || '')))
      .map(row => ({ ...row, description: '' })), fetchedAt: new Date().toISOString() };
}, ['explore-catalogue-chunk-v3'], { revalidate: 21600 });

async function readCataloguePool(type: RawgListType, year: number, genre: string, day: string) {
  const rows: GameRow[] = [];
  let fetchedAt = new Date().toISOString();
  for (let offset = 0; offset < 20000; offset += 500) {
    const chunks = await Promise.all([offset,offset + 250].map(start => readCatalogueChunk(type,year,genre,day,start)));
    for (const chunk of chunks) {
      rows.push(...chunk.rows);
      if (chunk.fetchedAt < fetchedAt) fetchedAt = chunk.fetchedAt;
      if (chunk.complete) return { rows: dedupePublicCanonicalRows(rows), fetchedAt };
    }
  }
  throw new Error('Explore pool exceeds supported read budget');
}

const definitions: Record<RawgListType, string> = {
  'best-of-year': 'Upcoming or awaiting full release; RAWG library additions measure interest, not wishlists. Release dates are provider-reported.',
  'popular-in-year': 'Released games from the selected year with at least 100 reviews. Verdict ranking balances scores with review confidence; popularity uses review volume. Alphabetical and date options use the selected order.',
  'all-time': 'VerdictGames Top 250: released primary games with at least 100 reviews, ordered by confidence-weighted Verdict ranking. Editions are deduplicated.',
  recent: 'Games released in the last 30 days. Release-date sorting uses the catalogue release date; added-to-catalogue sorting uses when the record was added.',
  genre: 'Primary games classified in the selected catalogue genre, ordered by review volume. Highest-rated sorting requires at least 100 reviews.',
};

export function sortExploreItems(items: RawgListGameItem[], sort: ExploreSort, type: RawgListType) {
  const selected = sort === 'default' ? type === 'recent' ? 'newest' : type === 'best-of-year' || type === 'genre' ? 'popular' : 'rating' : sort;
  return [...items].sort((a, b) => {
    let result = 0;
    if (selected === 'name-asc') result = a.name.localeCompare(b.name);
    if (selected === 'name-desc') result = b.name.localeCompare(a.name);
    if (selected === 'rating') result = (b.rankingScore || 0) - (a.rankingScore || 0);
    if (selected === 'popular') result = (b.metricSource === 'rawg' ? b.added : b.ratingsCount) - (a.metricSource === 'rawg' ? a.added : a.ratingsCount);
    if (selected === 'newest') result = (b.released || '').localeCompare(a.released || '');
    if (selected === 'oldest') result = (a.released || '9999').localeCompare(b.released || '9999');
    if (selected === 'added') result = (b.catalogueAdded || '').localeCompare(a.catalogueAdded || '');
    return result || a.slug.localeCompare(b.slug);
  });
}

export type ExplorePhase = 'snapshot' | 'matches' | 'catalogue_query' | 'legacy_pool';
export async function loadExplore(type: RawgListType, page = 1, pageSize = 20, year = new Date().getFullYear() - 1, genre = 'action', sort: ExploreSort = 'default', platform = '', onTiming?: (phase: ExplorePhase, milliseconds: number) => void, options?: { snapshotOnly?: boolean; releaseMonth?: string; calendar?: boolean }): Promise<RawgListResponse> {
  // Measure outside cache callbacks so diagnostics never multiply cache keys.
  async function measure<T>(phase: ExplorePhase, operation: () => PromiseLike<T>): Promise<T> {
    const start = performance.now();
    try { return await operation(); } finally { onTiming?.(phase, performance.now() - start); }
  }
  const today = new Date().toISOString().slice(0, 10);
  const communityDefault = (type === 'all-time' || type === 'popular-in-year') && sort === 'default';
  if (communityDefault) {
    try { return await measure('snapshot', () => loadProviderRanking(type,year,page,pageSize,platform,today)); }
    catch (error) {
      if(error && typeof error === 'object' && 'code' in error) throw error;
      console.warn('[Explore] RAWG ranking unavailable; using labelled Verdict ranking');
    }
  }
  let items: RawgListGameItem[] | undefined;
  const source = 'catalogue' as const;
  let fetchedAt = new Date().toISOString();
  if (type === 'best-of-year') {
    try {
      const response = await measure('snapshot', options?.calendar ? readCalendarUpcomingSnapshot : readUpcoming);
      const seen = new Set<number>();
      const upcoming = response.results.filter(item => isPublicSafeRawgGame(item) && (item.tba || !item.released || item.released > today) && !seen.has(item.id) && Boolean(seen.add(item.id)));
      let matchesUnavailable = false;
      const matches = await measure('matches', () => options?.calendar
        ? boundedHomepageRead(900, () => readUpcomingMatches(upcoming.map(item => item.id)))
        : readUpcomingMatches(upcoming.map(item => item.id))).catch(() => {matchesUnavailable=true;return [];});
      const byId = new Map((matches || []).map(item => [item.rawg_id, item]));
      const eligibleUpcoming = upcoming.filter(item => {
        const local = byId.get(item.id);
        return !local || isPublicSafeGame(local) && !hasKnownFullRelease(local)
          && !matchReviewedCatalogueRelease(local) && isPrimaryDiscoveryGame(local);
      });
      const normalizedPlatform = (name: string) => name === 'Xbox Series S/X' ? 'Xbox Series X|S' : name;
      const safeUpcoming = eligibleUpcoming.filter(item => isPrimaryDiscoveryGame({title:item.name,description:''})
        && !['cancelled','canceled','delisted'].includes(byId.get(item.id)?.release_status || '')
        && /^[a-z0-9-]{1,100}$/i.test(byId.get(item.id)?.slug || item.slug)
        && (!platform || item.platforms?.some(p => normalizedPlatform(p.platform.name) === platform)));
      const identity = (item: typeof safeUpcoming[number]) => ({ title: item.name, igdbId: byId.get(item.id)?.igdb_id });
      const evidence = await readReleaseTimings(eligibleUpcoming.map(identity));
      const releaseTimings = new Map(safeUpcoming.map(item => [item.id, resolveReleaseTiming(item.released, {
        upcoming: true, tba: item.tba,
        evidence: getReviewedReleaseTiming(item.id, item.released, evidence(identity(item), item.released)),
      })]));
      const ordered = safeUpcoming
        .filter(item => !options?.releaseMonth || releaseTimingMonth(releaseTimings.get(item.id)!) === options.releaseMonth)
        .sort((a,b) => {
        const result = sort === 'name-asc' ? a.name.localeCompare(b.name)
          : sort === 'name-desc' ? b.name.localeCompare(a.name)
          : sort === 'newest' || sort === 'oldest' ? compareUpcomingTiming(releaseTimings.get(a.id)!, releaseTimings.get(b.id)!, sort === 'newest')
          : b.added-a.added;
        return result || a.slug.localeCompare(b.slug);
      });
      const identities = new Set<string>();
      const distinct = ordered.filter(item => {
        const local = byId.get(item.id);
        const keys = [`slug:${local?.slug || item.slug}`, `title:${normalizeTitle(local?.title || item.name)}`];
        if (local?.steam_app_id) keys.push(`steam:${local.steam_app_id}`);
        if (keys.some(key => identities.has(key))) return false;
        for (const key of keys) identities.add(key);
        return true;
      });
      const visible = distinct.slice((page-1)*pageSize,page*pageSize);
      const mapped:RawgListGameItem[] = visible.map(item => {
        const local=byId.get(item.id);
        const releaseTiming = releaseTimings.get(item.id)!;
        const reviewed = reviewedUpcomingArtwork(item.id, item.name);
        const artwork = selectCatalogueArtwork(local, item.background_image);
        if (reviewed && (!local?.header_image || !local.is_featured_manual &&
          (local.header_image === local.cover_image || local.header_image === item.background_image))) {
          artwork.landscapeImage = reviewed.landscape;
          artwork.landscapeImageKind = 'artwork';
          if (artwork.imageKind !== 'cover') {
            artwork.image = reviewed.portrait ?? reviewed.landscape;
            artwork.imageKind = reviewed.portrait ? 'cover' : 'artwork';
          }
        }
        return {rawgId:item.id,slug:local?.slug || (item.slug==='grand-theft-aito-vi'?'grand-theft-auto-vi':item.slug),name:item.name,
          catalogueId:local?.id,tags:(item.tags||[]).map(tag=>tag.name),monetization:local?.monetization as Game['monetization'] | undefined,
          released:item.released,tba:releaseTiming.precision === 'tba',...artwork,
          rating:item.rating,ratingsCount:item.ratings_count,metacritic:item.metacritic,metricSource:'rawg',
          earlyAccess:hasEarlyAccessSignal(local ?? { tags: (item.tags || []).map(tag => tag.name) }),
          releaseTiming,releaseWindow:releaseTiming.precision === 'day' || releaseTiming.precision === 'tba' ? undefined : formatReleaseTiming(releaseTiming),
          added:item.added,
          toplay:item.added_by_status?.toplay || 0,playing:item.added_by_status?.playing || 0,owned:item.added_by_status?.owned || 0,
          platforms:(item.platforms||[]).map(p=>p.platform.name),genres:(item.genres||[]).map(g=>g.name),screenshots:[],clip:null};
      });
      return {items:mapped,count:distinct.length,page,pageSize,hasNext:page*pageSize<distinct.length,source:'rawg',
        fetchedAt:response.fetchedAt,degraded:matchesUnavailable || !response.complete || Date.now()-Date.parse(response.fetchedAt)>43200_000,
        ...(matchesUnavailable ? {notice:'Some catalogue details are temporarily unavailable. Showing upcoming provider records.'} : {}),
        definition:'Upcoming games and Early Access releases, ordered by interest on RAWG. Library additions and want-to-play counts are shown separately. Dates can change.'};

    } catch (error) {
      if(options?.snapshotOnly || error && typeof error === 'object' && 'code' in error) throw error;
      console.warn('[Explore] Stored catalogue fallback', { type: error instanceof Error ? error.name : 'provider' });
    }
  }
  if (!items) {
    const compact = await measure('catalogue_query', () => readCataloguePage(type,year,EXPLORE_GENRES[genre] || '',platform,type === 'all-time' ? 'default' : sort,page,pageSize,today));
    if (compact) {
      const visible:RawgListGameItem[]=compact.rows.map(row=>({
        catalogueId:row.id,rawgId:row.rawg_id || 0,slug:row.slug,name:row.title,...selectCatalogueArtwork(row),tags:row.tags || [],
        released:row.release_date,
        ...(type === 'best-of-year' ? { releaseTiming: resolveReleaseTiming(row.release_date, { upcoming: true,
          tba: hasEarlyAccessSignal(row) && Boolean(row.release_date && row.release_date <= today),
          evidence: getReviewedReleaseTiming(row.rawg_id, row.release_date),
        }) } : {}),
        tba:!row.release_date || type==='best-of-year' && hasEarlyAccessSignal(row) && Boolean(row.release_date && row.release_date<=today),
        earlyAccess:hasEarlyAccessSignal(row),metricSource:'catalogue',verdictScore:row.verdict_score || row.score,
        rankingScore:row.ranking_score,catalogueAdded:row.created_at,
        ...(row.rank ? {rank:row.rank} : {}),
        rating:0,ratingsCount:row.review_count || 0,metacritic:null,added:0,toplay:0,playing:0,owned:0,
        platforms:row.platforms || [],genres:row.genres || [],screenshots:[],clip:null,
      }));
      return {count:compact.count,page,pageSize,hasNext:page*pageSize<compact.count,items:visible,source:'catalogue',
        fetchedAt:compact.fetchedAt,degraded:type==='best-of-year' || communityDefault,definition:definitions[type]};
    }
    const pool = await measure('legacy_pool', () => readCataloguePool(type, type === 'popular-in-year' ? year : 0, type === 'genre' ? genre : '', today));
    fetchedAt = pool.fetchedAt;
    items = pool.rows.map(row => ({
      catalogueId:row.id,rawgId: row.rawg_id || 0, slug: row.slug, name: row.title, ...selectCatalogueArtwork(row),tags:row.tags || [],
      released: row.release_date, tba: !row.release_date || type === 'best-of-year' && hasEarlyAccessSignal(row) && Boolean(row.release_date && row.release_date <= today), earlyAccess: hasEarlyAccessSignal(row),
      ...(type === 'best-of-year' ? { releaseTiming: resolveReleaseTiming(row.release_date, { upcoming: true,
        tba: hasEarlyAccessSignal(row) && Boolean(row.release_date && row.release_date <= today),
        evidence: getReviewedReleaseTiming(row.rawg_id, row.release_date),
      }) } : {}),
      metricSource: 'catalogue', verdictScore: row.verdict_score || row.score, rankingScore: confidenceWeightedScore(row), catalogueAdded: row.created_at,
      rating: 0, ratingsCount: row.review_count || 0, metacritic: null, added: 0, toplay: 0, playing: 0, owned: 0,
      platforms: row.platforms || [], genres: row.genres || [], screenshots: [], clip: null,
    }));
  }
  items = sortExploreItems(items, 'default', type);
  if (type === 'genre' && sort === 'rating') items = items.filter(item => item.ratingsCount >= 100);
  if (type === 'all-time') items = items.slice(0, 250).map((item, index) => ({ ...item, rank: index + 1 }));
  if (platform) items = items.filter(item => item.platforms.some(name => name === platform || platform === 'Xbox Series X|S' && name === 'Xbox Series S/X'));
  if (type !== 'all-time') items = sortExploreItems(items, sort, type);
  const offset = (page - 1) * pageSize;
  const visible = items.slice(offset, offset + pageSize);
  return { count: items.length, page, pageSize, hasNext: offset + pageSize < items.length, items: visible, source, fetchedAt,
    degraded: type === 'best-of-year' || communityDefault, definition: definitions[type] };
}
