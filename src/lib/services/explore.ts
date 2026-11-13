import { unstable_cache } from 'next/cache';
import { getPublicSupabase } from '@/lib/supabase/public';
import { isPublicSafeGame } from '@/lib/utils/publicSafety';
import type { RawgListResponse, RawgListType } from '@/lib/api';

const GENRES: Record<string, string> = { 'role-playing-games-rpg': 'RPG', action: 'Action', adventure: 'Adventure', shooter: 'Shooter', strategy: 'Strategy', simulation: 'Simulation', puzzle: 'Puzzle', racing: 'Racing', sports: 'Sports', fighting: 'Fighting', platformer: 'Platformer', indie: 'Indie' };
export const EXPLORE_TYPES = new Set(['best-of-year', 'popular-in-year', 'all-time', 'recent', 'genre']);

// Bounded shared pools avoid provider calls and per-page database queries.
const readExplorePool = unstable_cache(async (type: RawgListType, year: number, genre: string) => {
  const today = new Date().toISOString().slice(0, 10);
  let query = getPublicSupabase().from('games')
    .select('rawg_id,slug,title,release_date,cover_image,header_image,score,review_count,current_players,platforms,genres,tags,description')
    .not('cover_image', 'is', null).neq('cover_image', '');
  if (type === 'best-of-year') query = query.gt('release_date', today).order('review_count', { ascending: false });
  else if (type === 'popular-in-year') query = query.gte('release_date', `${year}-01-01`).lte('release_date', `${year}-12-31`).order('score', { ascending: false });
  else if (type === 'recent') query = query.lte('release_date', today).order('release_date', { ascending: false });
  else if (type === 'genre') query = query.contains('genres', [GENRES[genre] ?? 'Action']).order('review_count', { ascending: false });
  else query = query.lte('release_date', today).gte('review_count', 100).order('score', { ascending: false });
  const { data, error } = await query.order('id').limit(250).abortSignal(AbortSignal.timeout(5000));
  if (error) throw error;
  return (data ?? []).filter(isPublicSafeGame).map(row => ({
    rawgId: row.rawg_id ?? 0, slug: row.slug, name: row.title,
    released: row.release_date, tba: !row.release_date, image: row.header_image || row.cover_image,
    rating: row.score / 20, ratingsCount: row.review_count ?? 0, metacritic: null,
    added: row.review_count ?? 0, toplay: 0, playing: row.current_players ?? 0, owned: 0,
    platforms: row.platforms ?? [], genres: row.genres ?? [], screenshots: [], clip: null,
  }));
}, ['explore-catalog-v1'], { revalidate: 3600 });

export async function loadExplore(type: RawgListType, page = 1, pageSize = 20, year = new Date().getFullYear() - 1, genre = 'action'): Promise<RawgListResponse> {
  const items = await readExplorePool(type, type === 'popular-in-year' ? year : 0, type === 'genre' ? genre : '');
  const offset = (page - 1) * pageSize;
  return { count: items.length, page, pageSize, hasNext: offset + pageSize < items.length, items: items.slice(offset, offset + pageSize) };
}
