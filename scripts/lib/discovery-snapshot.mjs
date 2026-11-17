import { rawgFetchJson } from './rawg-client.mjs';
import { isUpcomingSnapshot } from '../../src/lib/external/rawg-snapshot.mjs';
export async function refreshDiscoverySnapshot(sql) {
  const now = new Date();
  const end = new Date(now); end.setUTCFullYear(end.getUTCFullYear() + 3);
  const result = await rawgFetchJson('/games', { timeoutMs: 8000, attempts: 2,
    params: { dates: `${now.toISOString().slice(0,10)},${end.toISOString().slice(0,10)}`, ordering: '-added', page_size: 100, exclude_additions: true } });
  if (!isUpcomingSnapshot(result)) throw new Error('Invalid upcoming snapshot; previous value preserved');
  // Existing service-only cache, separate namespace; no new infrastructure.
  await sql`INSERT INTO public.gx_cache(feed_key,payload,fetched_at,updated_at)
    VALUES ('discovery:rawg:upcoming:v1',${sql.json({ results: result.results })},now(),now())
    ON CONFLICT(feed_key) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at,updated_at=excluded.updated_at`;
  return result.results.length;
}
