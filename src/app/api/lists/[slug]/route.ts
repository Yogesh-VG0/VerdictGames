import { NextRequest } from 'next/server';
import { jsonOk, jsonPrivateOk, jsonNotFound, jsonError } from '@/lib/api/response';
import { loadPublicList, readOwnedList } from '@/lib/services/public-list';
import { getCurrentUser, getAuthSupabase } from '@/lib/supabase/auth';
export const maxDuration = 30;
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const scope=request.nextUrl.searchParams.get('scope')||'public';
  if(!['public','mine'].includes(scope))return jsonError('Invalid collection scope.',400);
  try {
    if(scope==='mine'){
      const user=await getCurrentUser();
      if(!user)return jsonError('Not authenticated.',401);
      const list=await readOwnedList(await getAuthSupabase(),slug,user.profileId);
      return list?jsonPrivateOk(list):jsonNotFound('List');
    }
    const list = await loadPublicList(slug);
    return list ? jsonOk(list, 200, { cacheControl: 's-maxage=300, stale-while-revalidate=300' }) : jsonNotFound('List');
  } catch (error) {
    const code=error&&typeof error==='object'&&'code' in error&&typeof error.code==='string'&&/^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(error.code)?error.code:'UNKNOWN';
    console.error('[API] List unavailable', {scope,code});
    return jsonError('List data temporarily unavailable', 503);
  }
}
