import { NextRequest } from 'next/server';
import { jsonOk, jsonError } from '@/lib/api/response';
import { loadExplore } from '@/lib/services/explore';
import { EXPLORE_TYPES, EXPLORE_GENRES, EXPLORE_MAX_PAGE, EXPLORE_PAGE_SIZE, EXPLORE_PLATFORMS, normalizeExploreSort } from '@/lib/utils/explore-filters';
import type { RawgListType } from '@/lib/api';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const type = (sp.get('type') ?? 'best-of-year') as RawgListType;
  const page = Number(sp.get('page') ?? 1);
  const pageSize = Number(sp.get('pageSize') ?? EXPLORE_PAGE_SIZE);
  const year = Number(sp.get('year') ?? new Date().getFullYear() - 1);
  const genre = sp.get('genre') ?? 'action';
  const sort = EXPLORE_TYPES.has(type) ? normalizeExploreSort(type, sp.get('sort') ?? 'default') : null;
  const platform = sp.get('platform') ?? '';
  if (!sort || platform && !EXPLORE_PLATFORMS.has(platform) || type === 'genre' && !Object.hasOwn(EXPLORE_GENRES, genre)) return jsonError('Invalid category sorting or filters.', 400);
  if (!EXPLORE_TYPES.has(type) || !Number.isInteger(page) || page < 1 || page > EXPLORE_MAX_PAGE || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 40 || !Number.isInteger(year) || year < 1970 || year > new Date().getFullYear() + 1 || !/^[a-z-]{1,40}$/.test(genre)) return jsonError('Invalid browse filters.', 400);
  const started = performance.now();
  const timings: string[] = [];
  const timed = (response: Response) => {
    response.headers.set('Server-Timing', [...timings, `catalogue_total;dur=${Math.round(performance.now()-started)}`].join(', '));
    return response;
  };
  try {
    const data = await loadExplore(type, page, pageSize, year, genre, sort, platform, (phase, milliseconds) => {
      if (timings.length < 8 && /^[a-z_]{1,24}$/.test(phase) && Number.isFinite(milliseconds)) timings.push(`${phase};dur=${Math.max(0,Math.round(milliseconds))}`);
    });
    return timed(jsonOk(data, 200, { cacheControl: data.degraded
      ? 'public, s-maxage=60, stale-while-revalidate=300'
      : 'public, s-maxage=3600, stale-while-revalidate=86400' }));
  } catch (error) {
    console.warn('[Explore] Catalogue read failed', { code: error && typeof error === 'object' && 'code' in error ? error.code : error instanceof Error ? error.name : 'unknown' });
    return timed(jsonError('The game catalogue is temporarily unavailable. Please retry shortly.', 503));
  }
}
