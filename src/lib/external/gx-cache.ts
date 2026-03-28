/**
 * VERDICT.GAMES — GX Corner Durable Cache
 *
 * Wraps GX Corner API calls with a Supabase-backed durable cache.
 * On fresh fetch success: updates cache + returns fresh data.
 * On fresh fetch failure: returns last-known-good from cache.
 *
 * This ensures the frontend always has GX data even when the
 * upstream GX API is down or flaky.
 *
 * Server-only — called from /api/gx/* proxy routes.
 */

import { getServerSupabase } from "@/lib/supabase/server";

type FeedKey =
  | "highlights"
  | "calendar"
  | "free_to_play"
  | "top_games"
  | "deals"
  | "top_liked"
  | "news_popular"
  | "news_feed";

/**
 * Fetch with durable cache: try live, cache on success, fallback on failure.
 *
 * @param feedKey — cache key in gx_cache table
 * @param liveFetcher — function that fetches live data from GX API
 * @param staleTtlMs — max age of cached data before we force a live fetch (default 6h)
 */
export async function gxFetchWithCache<T>(
  feedKey: FeedKey,
  liveFetcher: () => Promise<T>,
  staleTtlMs = 6 * 60 * 60 * 1000
): Promise<{ data: T; source: "live" | "cache" | "empty" }> {
  const supabase = getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cacheTable = supabase.from("gx_cache") as any;

  // 1. Try live fetch
  try {
    const liveData = await liveFetcher();

    // Only cache non-empty results
    const isNonEmpty = Array.isArray(liveData) ? liveData.length > 0 : !!liveData;
    if (isNonEmpty) {
      // Fire and forget — don't block the response on cache write
      cacheTable
        .upsert({
          feed_key: feedKey,
          payload: JSON.stringify(liveData),
          fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .then(() => {})
        .catch((err: Error) => {
          console.warn(`[GX Cache] Failed to update cache for ${feedKey}:`, err.message);
        });
    }

    return { data: liveData, source: "live" };
  } catch (liveErr) {
    console.warn(`[GX Cache] Live fetch failed for ${feedKey}:`, (liveErr as Error).message);
  }

  // 2. Fallback to cache
  try {
    const { data: cached } = await cacheTable
      .select("payload, fetched_at")
      .eq("feed_key", feedKey)
      .single() as { data: { payload: string; fetched_at: string } | null };

    if (cached?.payload) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      const parsed = JSON.parse(cached.payload) as T;
      const isStale = age > staleTtlMs;

      if (isStale) {
        console.warn(`[GX Cache] Serving stale cache for ${feedKey} (age: ${Math.round(age / 60000)}min)`);
      }

      return { data: parsed, source: "cache" };
    }
  } catch (cacheErr) {
    console.warn(`[GX Cache] Cache read failed for ${feedKey}:`, (cacheErr as Error).message);
  }

  // 3. Both failed — return empty
  return { data: ([] as unknown) as T, source: "empty" };
}
