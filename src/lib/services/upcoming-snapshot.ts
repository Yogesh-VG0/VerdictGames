import { getServerSupabase } from '@/lib/supabase/server';
import { getRawgUpcoming, type RawgListItem } from '@/lib/external/rawg';
import { isUpcomingSnapshot } from '@/lib/external/rawg-snapshot.mjs';
import { unstable_cache } from 'next/cache';
import { coalesceCatalogueRead } from '@/lib/db/cached-catalogue';

export const UPCOMING_SNAPSHOT_KEY = 'discovery:rawg:upcoming:v1';
const SNAPSHOT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const REFRESH_AFTER_MS = 8 * 60 * 60 * 1000;

/** Public requests only READ this service-only durable cache. The existing
 * discovery worker writes validated snapshots; no anonymous request writes. */
async function readPublishedUpcomingSnapshot() {
  let stored: { results: RawgListItem[]; fetchedAt: string; complete: boolean } | undefined;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { data, error } = await getServerSupabase().from('gx_cache').select('payload,fetched_at')
        .eq('feed_key', UPCOMING_SNAPSHOT_KEY).abortSignal(AbortSignal.timeout(1500)).maybeSingle();
      if (!error && data && isUpcomingSnapshot(data.payload) && Number.isFinite(Date.parse(data.fetched_at))) {
        stored = { results: data.payload.results, fetchedAt: data.fetched_at, complete: data.payload.complete === true && data.payload.count === data.payload.results.length };
        if (stored.complete) return stored;
      }
    } catch { /* Live provider or catalogue remain available. */ }
  }
  return stored;
}

const readCachedPublishedUpcomingSnapshot = unstable_cache(async () => {
  const stored = await readPublishedUpcomingSnapshot();
  if (!stored?.complete) throw new Error('Published upcoming snapshot unavailable');
  return stored;
}, ['published-upcoming-v1'], { revalidate: 300, tags: ['public-explore'] });

const readLiveUpcoming = unstable_cache(coalesceCatalogueRead(async () => {
  const live = await getRawgUpcoming(AbortSignal.timeout(2000));
  if (!isUpcomingSnapshot(live) || live.count !== live.results.length) throw new Error('Invalid upcoming response');
  return { results: live.results, fetchedAt: new Date().toISOString(), complete: true };
}), ['explore-live-upcoming-v1'], { revalidate: 1800, tags: ['public-explore'] });

export async function readUpcomingSnapshot() {
  const stored = await readCachedPublishedUpcomingSnapshot().catch(() => undefined);
  const age = stored ? Date.now() - Date.parse(stored.fetchedAt) : Infinity;
  if (stored && age >= 0 && age < REFRESH_AFTER_MS) return stored;
  try {
    const live = await readLiveUpcoming();
    if (Date.now() - Date.parse(live.fetchedAt) > SNAPSHOT_MAX_AGE_MS) throw new Error('Upcoming snapshot expired');
    return live;
  } catch (error) {
    // Retain the original timestamp so each surface can mark or omit expired data.
    if (stored && age >= 0) return stored;
    throw error;
  }
}

export const readCachedUpcomingSnapshot = readUpcomingSnapshot;
