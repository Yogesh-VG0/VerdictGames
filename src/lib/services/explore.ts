import { unstable_cache } from 'next/cache';
import { getPublicSupabase } from '@/lib/supabase/public';
import { isPublicSafeGame, isPublicSafeRawgGame } from '@/lib/utils/publicSafety';
import { readUpcomingSnapshot } from '@/lib/services/upcoming-snapshot';
import { getIgdbPortraits } from '@/lib/external/igdb';
import { matchPortrait, isPortraitArtwork } from '@/lib/utils/artwork';
import { isPrimaryDiscoveryGame } from '@/lib/utils/discovery';
import { dedupePublicCanonicalRows } from '@/lib/utils/publicCanonical';
import { confidenceWeightedScore } from '@/lib/utils/quality';
import { hasEarlyAccessSignal } from '@/lib/utils/release-status';
import { readCataloguePage } from '@/lib/services/explore-query';
import type { GameRow } from '@/lib/supabase/types';
import type { RawgListResponse, RawgListType, RawgListGameItem, ExploreSort } from '@/lib/api';

export const EXPLORE_GENRES: Record<string, string> = { 'role-playing-games-rpg': 'RPG', action: 'Action', adventure: 'Adventure', shooter: 'Shooter', strategy: 'Strategy', simulation: 'Simulation', puzzle: 'Puzzle', racing: 'Racing', sports: 'Sports', fighting: 'Fighting', platformer: 'Platformer', indie: 'Indie' };
export const EXPLORE_TYPES = new Set(['best-of-year', 'popular-in-year', 'all-time', 'recent', 'genre']);
export const EXPLORE_SORTS = new Set(['default', 'rating', 'popular', 'name-asc', 'name-desc', 'newest', 'oldest', 'added']);
export const EXPLORE_PLATFORMS = new Set(['PC', 'PlayStation 5', 'PlayStation 4', 'Xbox Series X|S', 'Xbox One', 'Nintendo Switch', 'Android', 'iOS', 'Linux', 'macOS']);
const columns = 'id,rawg_id,slug,title,release_date,release_status,cover_image,header_image,steam_app_id,score,verdict_score,confidence,review_count,current_players,platforms,genres,tags,description,franchise,developer,publisher,created_at';

let portraitsRetryAt = 0;
const readPortraits = unstable_cache(async (titles: string[]) => {
  if (Date.now() < portraitsRetryAt) throw new Error('Artwork provider cooldown');
  try { return await getIgdbPortraits(titles); }
  catch (error) { portraitsRetryAt = Date.now() + 60_000; throw error; }
}, ['explore-igdb-portraits-v3'], { revalidate: 86400 });
// Cache confirmed absence, never a transient network failure.
const verifiedSteamPoster = unstable_cache(async (appId: number): Promise<string | null> => {
  if (!Number.isSafeInteger(appId) || appId <= 0) return null;
  const image = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`;
  const response = await fetch(image, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) throw new Error('Steam artwork unavailable');
  return response.headers.get('content-type')?.startsWith('image/') ? image : null;
}, ['verified-steam-poster-v2'], { revalidate: 86400 });

async function titleArtwork(row: Pick<GameRow, 'cover_image' | 'header_image' | 'steam_app_id'>) {
  if (isPortraitArtwork(row.cover_image)) return row.cover_image;
  if (row.steam_app_id) {
    try { return await verifiedSteamPoster(row.steam_app_id) || row.cover_image || row.header_image; } catch { /* Keep known artwork. */ }
  }
  return row.cover_image || row.header_image;
}

async function repairVisibleArtwork(items: RawgListGameItem[], rowFor: (item: RawgListGameItem, index: number) => Pick<GameRow, 'cover_image' | 'header_image' | 'steam_app_id'> | undefined) {
  // Group actual repair work. Unchanged posters must not serialize two sparse
  // network probes merely because their cards fall in different grid batches.
  const repairs = items.flatMap((item,index) => {
    const row = rowFor(item,index);
    return row && !isPortraitArtwork(item.image) ? [{item,row}] : [];
  });
  for (let index=0;index<repairs.length;index+=4) await Promise.all(repairs.slice(index,index+4).map(async ({item,row}) => {
    item.image = await titleArtwork(row);
    item.imageKind = isPortraitArtwork(item.image) ? 'cover' : 'artwork';
  }));
}

// A failure throws so Next retains its last good snapshot on revalidation.
const readUpcoming = unstable_cache(readUpcomingSnapshot, ['explore-upcoming-snapshot-v2'], { revalidate: 21600 });

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
      && !['cancelled', 'canceled', 'delisted'].includes(row.release_status || '')
      && (!['all-time','popular-in-year','recent'].includes(type) || !hasEarlyAccessSignal(row) && !['announced','coming_soon','upcoming','tba'].includes(row.release_status || '')))
      .map(row => ({ ...row, description: '' })), fetchedAt: new Date().toISOString() };
}, ['explore-catalogue-chunk-v2'], { revalidate: 21600 });

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
  'popular-in-year': 'VerdictGames best of the selected release year: confidence-weighted Verdict ranking, at least 100 reviews. Popularity sort uses review volume.',
  'all-time': 'VerdictGames Top 250: released primary games with at least 100 reviews, ordered by confidence-weighted Verdict ranking. Editions are deduplicated.',
  recent: 'Games released in the last 30 days, newest first. Dates reflect the catalogue release date, not when records were added.',
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

export type ExplorePhase = 'snapshot' | 'matches' | 'portraits' | 'provider_artwork' | 'catalogue_query' | 'catalogue_artwork' | 'legacy_pool';
export async function loadExplore(type: RawgListType, page = 1, pageSize = 20, year = new Date().getFullYear() - 1, genre = 'action', sort: ExploreSort = 'default', platform = '', onTiming?: (phase: ExplorePhase, milliseconds: number) => void): Promise<RawgListResponse> {
  // Measure outside cache callbacks so diagnostics never multiply cache keys.
  async function measure<T>(phase: ExplorePhase, operation: () => PromiseLike<T>): Promise<T> {
    const start = performance.now();
    try { return await operation(); } finally { onTiming?.(phase, performance.now() - start); }
  }
  const today = new Date().toISOString().slice(0, 10);
  let items: RawgListGameItem[] | undefined;
  let source: 'rawg' | 'catalogue' = 'catalogue';
  let fetchedAt = new Date().toISOString();
  const artworkRows = new Map<string, Pick<GameRow, 'cover_image' | 'header_image' | 'steam_app_id'>>();
  if (type === 'best-of-year') {
    try {
      const response = await measure('snapshot', () => readUpcoming());
      const seen = new Set<number>();
      const upcoming = response.results.filter(item => isPublicSafeRawgGame(item) && (item.tba || !item.released || item.released > today) && !seen.has(item.id) && Boolean(seen.add(item.id)));
      const { data: matches, error } = await measure('matches', () => getPublicSupabase().from('games').select('rawg_id,slug,cover_image,header_image,steam_app_id,tags,genres,release_status').in('rawg_id', upcoming.map(item => item.id)));
      if (error) throw error;
      const byId = new Map((matches || []).map(item => [item.rawg_id, item]));
      const missing = upcoming.filter(item => !isPortraitArtwork(byId.get(item.id)?.cover_image));
      const portraits = missing.length ? await measure('portraits', () => readPortraits(missing.map(item => item.name))).catch(() => []) : [];
      items = await measure('provider_artwork', () => Promise.all(upcoming.map(async item => {
        const local = byId.get(item.id);
        const image = (local && isPortraitArtwork(local.cover_image) ? local.cover_image : matchPortrait(item, portraits))
          || (local ? await titleArtwork(local) : null) || item.background_image;
        return {
          rawgId: item.id, slug: local?.slug || (item.slug === 'grand-theft-aito-vi' ? 'grand-theft-auto-vi' : item.slug), name: item.name,
          released: item.released, tba: item.tba, image, imageKind: isPortraitArtwork(image) ? 'cover' as const : 'artwork' as const,
          rating: item.rating, ratingsCount: item.ratings_count, metacritic: item.metacritic, metricSource: 'rawg' as const,
          earlyAccess: Boolean(local && hasEarlyAccessSignal(local)),
          added: item.added, toplay: item.added_by_status?.toplay || 0, playing: item.added_by_status?.playing || 0, owned: item.added_by_status?.owned || 0,
          platforms: (item.platforms || []).map(p => p.platform.name), genres: (item.genres || []).map(g => g.name), screenshots: [], clip: null,
        };
      })));
      source = 'rawg'; fetchedAt = response.fetchedAt;
    } catch (error) { console.warn('[Explore] Stored catalogue fallback', { type: error instanceof Error ? error.name : 'provider' }); }
  }
  if (!items) {
    const compact = await measure('catalogue_query', () => readCataloguePage(type,year,EXPLORE_GENRES[genre] || '',platform,sort,page,pageSize,today));
    if (compact) {
      const visible:RawgListGameItem[]=compact.rows.map(row=>({
        rawgId:row.rawg_id || 0,slug:row.slug,name:row.title,image:row.cover_image || row.header_image,
        imageKind:isPortraitArtwork(row.cover_image)?'cover':'artwork',released:row.release_date,
        tba:!row.release_date || type==='best-of-year' && hasEarlyAccessSignal(row) && Boolean(row.release_date && row.release_date<=today),
        earlyAccess:hasEarlyAccessSignal(row),metricSource:'catalogue',verdictScore:row.verdict_score || row.score,
        rankingScore:row.ranking_score,catalogueAdded:row.created_at,
        ...(row.rank ? {rank:row.rank} : {}),
        rating:0,ratingsCount:row.review_count || 0,metacritic:null,added:0,toplay:0,playing:0,owned:0,
        platforms:row.platforms || [],genres:row.genres || [],screenshots:[],clip:null,
      }));
      await measure('catalogue_artwork', () => repairVisibleArtwork(visible,(_item,index)=>compact.rows[index]));
      return {count:compact.count,page,pageSize,hasNext:page*pageSize<compact.count,items:visible,source:'catalogue',
        fetchedAt:compact.fetchedAt,degraded:type==='best-of-year',definition:definitions[type]};
    }
    const pool = await measure('legacy_pool', () => readCataloguePool(type, type === 'popular-in-year' ? year : 0, type === 'genre' ? genre : '', today));
    fetchedAt = pool.fetchedAt;
    for (const row of pool.rows) artworkRows.set(row.slug, row);
    items = pool.rows.map(row => ({
      rawgId: row.rawg_id || 0, slug: row.slug, name: row.title, image: row.cover_image || row.header_image,
      imageKind: isPortraitArtwork(row.cover_image) ? 'cover' : 'artwork', released: row.release_date, tba: !row.release_date || type === 'best-of-year' && hasEarlyAccessSignal(row) && Boolean(row.release_date && row.release_date <= today), earlyAccess: hasEarlyAccessSignal(row),
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
  // At most four concurrent poster probes, and only for visible cards.
  await repairVisibleArtwork(visible,item=>artworkRows.get(item.slug));
  return { count: items.length, page, pageSize, hasNext: offset + pageSize < items.length, items: visible, source, fetchedAt,
    degraded: type === 'best-of-year' && (source !== 'rawg' || Date.now() - Date.parse(fetchedAt) > 43200_000), definition: definitions[type] };
}
