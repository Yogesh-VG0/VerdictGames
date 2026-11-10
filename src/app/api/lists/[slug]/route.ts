import { NextRequest } from 'next/server';
import { jsonOk, jsonNotFound, jsonError } from '@/lib/api/response';
import { loadPublicList } from '@/lib/services/public-list';
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const list = await loadPublicList(slug);
    return list ? jsonOk(list, 200, { cacheControl: 's-maxage=300, stale-while-revalidate=300' }) : jsonNotFound('List');
  } catch (error) {
    console.error('[API] Public list unavailable', error);
    return jsonError('List data temporarily unavailable', 503);
  }
}
