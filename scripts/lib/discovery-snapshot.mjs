import { rawgFetchJson } from './rawg-client.mjs';
import { isUpcomingSnapshot } from '../../src/lib/external/rawg-snapshot.mjs';
import { collectRawgPages } from '../../src/lib/external/rawg-discovery.mjs';
export async function refreshDiscoverySnapshot(sql) {
  const now = new Date();
  const end = new Date(now); end.setUTCFullYear(end.getUTCFullYear() + 3);
  const result = await collectRawgPages(page => rawgFetchJson('/games', { timeoutMs: 8000, attempts: 2,
    params: { dates: `${now.toISOString().slice(0,10)},${end.toISOString().slice(0,10)}`, ordering: '-added', page_size: 40, page, exclude_additions: true } }),1000);
  if (!result.complete) throw new Error('Upcoming snapshot exceeds read budget');
  if (!isUpcomingSnapshot(result)) throw new Error('Invalid upcoming snapshot; previous value preserved');
  // Existing service-only cache, separate namespace; no new infrastructure.
  await sql`INSERT INTO public.gx_cache(feed_key,payload,fetched_at,updated_at)
    VALUES ('discovery:rawg:upcoming:v1',${sql.json(result)},now(),now())
    ON CONFLICT(feed_key) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at,updated_at=excluded.updated_at`;
  return result.results.length;
}

/** Existing daily discovery owns these four bounded public snapshots. No
 * request handler writes them; a failed refresh preserves the previous value. */
export async function refreshCommunitySnapshots(sql) {
  const year=new Date().getUTCFullYear();
  const definitions=[['all-time',0],...Array.from({length:3},(_,index)=>['popular-in-year',year-index])];
  const results=[];
  for(const [type,releaseYear] of definitions) {
    try {
      const payload=await collectRawgPages(page=>rawgFetchJson(`/games/lists/${type==='all-time'?'popular':'greatest'}`,{
        timeoutMs:8000,attempts:2,params:{discover:true,page,page_size:40,...(releaseYear?{year:releaseYear,ordering:'-added'}:{})},
      }),250);
      if(!payload.complete || !isUpcomingSnapshot(payload))throw new Error('Invalid community snapshot');
      const key=`discovery:rawg:${type}:${releaseYear}:v1`;
      await sql`INSERT INTO public.gx_cache(feed_key,payload,fetched_at,updated_at)
        VALUES (${key},${sql.json(payload)},now(),now()) ON CONFLICT(feed_key)
        DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at,updated_at=excluded.updated_at`;
      results.push({type,year:releaseYear,rows:payload.results.length,ok:true});
    } catch(error) {
      // Infrastructure faults must reach the existing maintenance failure path.
      if(error?.code && /^[0-9A-Z]{5}$/.test(error.code))throw error;
      results.push({type,year:releaseYear,ok:false});
    }
  }
  return results;
}
