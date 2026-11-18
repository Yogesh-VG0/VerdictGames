import { unstable_cache } from 'next/cache';
import { getRawgCommunityRanking } from '@/lib/external/rawg';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUpcomingSnapshot } from '@/lib/external/rawg-snapshot.mjs';

export async function readStoredCommunityRanking(type:'all-time'|'popular-in-year',year:number) {
  // Same existing service-only durable cache; public requests never write it.
  let stored;
  if(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const {data,error}=await getServerSupabase().from('gx_cache').select('payload,fetched_at')
        .eq('feed_key',`discovery:rawg:${type}:${year}:v1`).abortSignal(AbortSignal.timeout(1500)).maybeSingle();
      if(!error && data && isUpcomingSnapshot(data.payload) && data.payload.complete===true
        && data.payload.count===data.payload.results.length && data.payload.results.length<=250 && Number.isFinite(Date.parse(data.fetched_at))) {
        stored={results:data.payload.results,fetchedAt:data.fetched_at};
      }
    } catch { /* Live provider or clearly labelled Verdict fallback. */ }
  }
  return stored;
}
async function read(type:'all-time'|'popular-in-year',year:number) {
  const stored=await readStoredCommunityRanking(type,year);
  if(stored && Date.now()-Date.parse(stored.fetchedAt)<21600_000)return stored;
  try {
    const value=await getRawgCommunityRanking(type,year);
    if(!value.complete || !isUpcomingSnapshot(value))throw new Error('Incomplete community ranking');
    return {results:value.results,fetchedAt:new Date().toISOString()};
  } catch(error) {if(stored)return stored;throw error;}
}
export const readHomepageReleaseRanking=unstable_cache(async()=>await readStoredCommunityRanking('popular-in-year',new Date().getUTCFullYear()) || null,['homepage-release-ranking-v1'],{revalidate:300,tags:['public-explore']});
const cached=unstable_cache(read,['rawg-community-ranking-v1'],{revalidate:21600,tags:['public-explore']});
export function readCommunityRanking(type:'all-time'|'popular-in-year',year:number) {
  const normalizedYear=type==='all-time'?0:year;
  if(type==='popular-in-year' && (!Number.isInteger(year) || year<1970 || year>new Date().getUTCFullYear()+1))throw new Error('Invalid ranking year');
  // At most one key per validated year plus All-Time; pages/platforms/sorts
  // share the same compact cohort. Historical filters must not repeatedly
  // spend seven provider reads merely because a different platform was chosen.
  return cached(type,normalizedYear);
}
