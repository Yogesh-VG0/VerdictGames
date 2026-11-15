import { getServerSupabase } from '@/lib/supabase/server';
import { getRawgUpcoming, type RawgListItem } from '@/lib/external/rawg';
import { isUpcomingSnapshot } from '@/lib/external/rawg-snapshot.mjs';

export const UPCOMING_SNAPSHOT_KEY = 'discovery:rawg:upcoming:v1';

/** Public requests only READ this service-only durable cache. The existing
 * discovery worker writes validated snapshots; no anonymous request writes. */
export async function readUpcomingSnapshot() {
  let stored: { results: RawgListItem[]; fetchedAt: string } | undefined;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { data, error } = await getServerSupabase().from('gx_cache').select('payload,fetched_at')
        .eq('feed_key', UPCOMING_SNAPSHOT_KEY).abortSignal(AbortSignal.timeout(1500)).maybeSingle();
      if (!error && data && isUpcomingSnapshot(data.payload) && Number.isFinite(Date.parse(data.fetched_at))) {
        stored = { results: data.payload.results, fetchedAt: data.fetched_at };
        if (Date.now() - Date.parse(stored.fetchedAt) < 21600_000) return stored;
      }
    } catch { /* Live provider or catalogue remain available. */ }
  }
  try {
    const live = await getRawgUpcoming();
    if (!isUpcomingSnapshot(live)) throw new Error('Invalid upcoming response');
    return { results: live.results, fetchedAt: new Date().toISOString() };
  } catch (error) {
    if (stored) return stored;
    throw error;
  }
}
