import { unstable_cache } from 'next/cache';
import { getPublicSupabase } from '@/lib/supabase/public';
import { isPublicSafeGame, isPublicSafeRawgGame } from '@/lib/utils/publicSafety';
import { getRawgUpcoming } from '@/lib/external/rawg';
import type { RawgListResponse, RawgListType } from '@/lib/api';

const GENRES: Record<string, string> = { 'role-playing-games-rpg': 'RPG', action: 'Action', adventure: 'Adventure', shooter: 'Shooter', strategy: 'Strategy', simulation: 'Simulation', puzzle: 'Puzzle', racing: 'Racing', sports: 'Sports', fighting: 'Fighting', platformer: 'Platformer', indie: 'Indie' };
export const EXPLORE_TYPES = new Set(['best-of-year', 'popular-in-year', 'all-time', 'recent', 'genre']);

// Some older imports saved screenshots in cover_image. Verify the official
// Steam poster only for those records, once per shared cache window.
const verifiedSteamPoster = unstable_cache(async (appId: number): Promise<string | null> => {
  if (!Number.isSafeInteger(appId) || appId <= 0) return null;
  const image = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`;
  try {
    const response = await fetch(image, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
    return response.ok && response.headers.get('content-type')?.startsWith('image/') ? image : null;
  } catch { return null; }
}, ['verified-steam-poster-v1'], { revalidate: 86400 });

async function titleArtwork(row: { cover_image: string | null; header_image: string | null; steam_app_id: number | null }) {
  if (row.steam_app_id && row.cover_image?.includes('/screenshots/')) {
    return await verifiedSteamPoster(row.steam_app_id) || row.cover_image;
  }
  return row.cover_image || row.header_image;
}

// Bounded shared pools avoid provider calls and per-page database queries.
const readExplorePool = unstable_cache(async (type: RawgListType, year: number, genre: string) => {
  const today = new Date().toISOString().slice(0, 10);
  if (type === 'best-of-year') {
    try {
      const response = await getRawgUpcoming();
      const upcoming = response.results.filter(item => isPublicSafeRawgGame(item) && (item.tba || !item.released || item.released >= today));
      const { data: matches } = await getPublicSupabase().from('games')
        .select('rawg_id,slug,cover_image').in('rawg_id', upcoming.map(item => item.id));
      const byId = new Map((matches ?? []).map(item => [item.rawg_id, item]));
      if (upcoming.length) return upcoming.map(item => ({
        rawgId: item.id, slug: byId.get(item.id)?.slug ?? (item.slug === 'grand-theft-aito-vi' ? 'grand-theft-auto-vi' : item.slug), name: item.name,
        released: item.released, tba: item.tba, image: byId.get(item.id)?.cover_image || item.background_image,
        imageKind: byId.get(item.id)?.cover_image ? 'cover' as const : 'artwork' as const,
        rating: item.rating, ratingsCount: item.ratings_count, metacritic: item.metacritic,
        added: item.added, toplay: item.added_by_status?.toplay ?? 0, playing: item.added_by_status?.playing ?? 0, owned: item.added_by_status?.owned ?? 0,
        platforms: (item.platforms ?? []).map(p => p.platform.name), genres: (item.genres ?? []).map(g => g.name), screenshots: [], clip: null,
      }));
    } catch (error) { console.warn('[Explore] Using stored upcoming catalogue', { type: error instanceof Error ? error.name : 'provider' }); }
  }
  let query = getPublicSupabase().from('games')
    .select('rawg_id,slug,title,release_date,cover_image,header_image,steam_app_id,score,review_count,current_players,platforms,genres,tags,description')
    .not('cover_image', 'is', null).neq('cover_image', '');
  if (type === 'best-of-year') query = query.gt('release_date', today).order('review_count', { ascending: false });
  else if (type === 'popular-in-year') query = query.gte('release_date', `${year}-01-01`).lte('release_date', `${year}-12-31`).order('score', { ascending: false });
  else if (type === 'recent') query = query.lte('release_date', today).order('release_date', { ascending: false });
  else if (type === 'genre') query = query.contains('genres', [GENRES[genre] ?? 'Action']).order('review_count', { ascending: false });
  else query = query.lte('release_date', today).gte('review_count', 100).order('score', { ascending: false });
  const { data, error } = await query.order('id').limit(250).abortSignal(AbortSignal.timeout(5000));
  if (error) throw error;
  return Promise.all((data ?? []).filter(isPublicSafeGame).map(async row => ({
    rawgId: row.rawg_id ?? 0, slug: row.slug, name: row.title, imageKind: 'cover' as const,
    released: row.release_date, tba: !row.release_date, image: await titleArtwork(row),
    rating: row.score / 20, ratingsCount: row.review_count ?? 0, metacritic: null,
    added: row.review_count ?? 0, toplay: 0, playing: row.current_players ?? 0, owned: 0,
    platforms: row.platforms ?? [], genres: row.genres ?? [], screenshots: [], clip: null,
  })));
}, ['explore-catalog-v3'], { revalidate: 21600 });

export async function loadExplore(type: RawgListType, page = 1, pageSize = 20, year = new Date().getFullYear() - 1, genre = 'action'): Promise<RawgListResponse> {
  const items = await readExplorePool(type, type === 'popular-in-year' ? year : 0, type === 'genre' ? genre : '');
  const offset = (page - 1) * pageSize;
  return { count: items.length, page, pageSize, hasNext: offset + pageSize < items.length, items: items.slice(offset, offset + pageSize) };
}
