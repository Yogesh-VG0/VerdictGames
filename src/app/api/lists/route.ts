import { NextRequest } from 'next/server';
import { jsonOk, jsonPrivateOk, jsonError } from '@/lib/api/response';
import { getCurrentUser, getAuthSupabase } from '@/lib/supabase/auth';
import { loadPublicListSummaries, readListSummaries } from '@/lib/services/lists';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const page = Number(request.nextUrl.searchParams.get('page') || 1);
  const scope = request.nextUrl.searchParams.get('scope') || 'public';
  const owner = request.nextUrl.searchParams.get('owner') || undefined;
  const kind = request.nextUrl.searchParams.get('kind') || 'all';
  const summaryView = request.nextUrl.searchParams.get('view') === 'summary';
  if (!['all', 'editorial', 'community'].includes(kind)) return jsonError('Invalid collection type.', 400);
  if (!Number.isInteger(page) || page < 1 || page > 1000 || !['public', 'mine'].includes(scope) || owner && !/^[a-f0-9-]{36}$/i.test(owner)) return jsonError('Invalid list filters.', 400);
  try {
    if (scope === 'mine') {
      const user = await getCurrentUser();
      if (!user) return jsonError('Not authenticated.', 401);
      const result = await readListSummaries(await getAuthSupabase(), page, user.profileId, true, kind);
      return jsonPrivateOk(summaryView ? result : result.items);
    }
    const result = await loadPublicListSummaries(page, owner, kind);
    return jsonOk(summaryView ? result : result.items, 200, { cacheControl: 'public, s-maxage=300, stale-while-revalidate=300' });
  } catch {
    return jsonError('Collections are temporarily unavailable. Please retry.', 503);
  }
}
