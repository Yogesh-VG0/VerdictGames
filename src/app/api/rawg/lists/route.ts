import { NextRequest } from 'next/server';
import { jsonOk, jsonError } from '@/lib/api/response';
import { EXPLORE_TYPES, EXPLORE_GENRES, EXPLORE_SORTS, EXPLORE_PLATFORMS, loadExplore } from '@/lib/services/explore';
import type { RawgListType, ExploreSort } from '@/lib/api';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const type = sp.get('type') ?? 'best-of-year';
  const page = Number(sp.get('page') ?? 1);
  const pageSize = Number(sp.get('pageSize') ?? 20);
  const year = Number(sp.get('year') ?? new Date().getFullYear() - 1);
  const genre = sp.get('genre') ?? 'action';
  const sort = sp.get('sort') ?? 'default';
  const platform = sp.get('platform') ?? '';
  if (!EXPLORE_SORTS.has(sort) || platform && !EXPLORE_PLATFORMS.has(platform) || type === 'genre' && !EXPLORE_GENRES[genre] || type === 'all-time' && !['default','rating'].includes(sort) || type === 'best-of-year' && ['rating', 'added'].includes(sort)) return jsonError('Invalid category sorting or filters.', 400);
  if (!EXPLORE_TYPES.has(type) || !Number.isInteger(page) || page < 1 || page > 250 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 40 || !Number.isInteger(year) || year < 1970 || year > new Date().getFullYear() + 1 || !/^[a-z-]{1,40}$/.test(genre)) return jsonError('Invalid browse filters.', 400);
  const started = performance.now();
  const timings: string[] = [];
  const timed = (response: Response) => {
    response.headers.set('Server-Timing', [...timings, `catalogue_total;dur=${Math.round(performance.now()-started)}`].join(', '));
    return response;
  };
  try {
    const data = await loadExplore(type as RawgListType, page, pageSize, year, genre, sort as ExploreSort, platform, (phase, milliseconds) => {
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
