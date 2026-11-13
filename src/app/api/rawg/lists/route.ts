import { NextRequest } from 'next/server';
import { jsonOk, jsonError } from '@/lib/api/response';
import { EXPLORE_TYPES, loadExplore } from '@/lib/services/explore';
import type { RawgListType } from '@/lib/api';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const type = sp.get('type') ?? 'best-of-year';
  const page = Number(sp.get('page') ?? 1);
  const pageSize = Number(sp.get('pageSize') ?? 20);
  const year = Number(sp.get('year') ?? new Date().getFullYear() - 1);
  const genre = sp.get('genre') ?? 'action';
  if (!EXPLORE_TYPES.has(type) || !Number.isInteger(page) || page < 1 || page > 250 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 40 || !Number.isInteger(year) || year < 1970 || year > new Date().getFullYear() + 1 || !/^[a-z-]{1,40}$/.test(genre)) return jsonError('Invalid browse filters.', 400);
  try {
    return jsonOk(await loadExplore(type as RawgListType, page, pageSize, year, genre), 200, { cacheControl: 'public, s-maxage=3600, stale-while-revalidate=86400' });
  } catch {
    return jsonError('The game catalogue is temporarily unavailable. Please retry shortly.', 503);
  }
}
