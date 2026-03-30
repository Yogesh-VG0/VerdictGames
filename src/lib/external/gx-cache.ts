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
import type { GXCalendarEntry } from "@/lib/external/gxcorner";
import type { GXCalendarGame, GXCalendarMonthResponse } from "@/lib/types";
import { filterGXCalendarEntriesByMonth, isPastCalendarMonth } from "@/lib/utils/gx-calendar";

type FeedKey =
  | "highlights"
  | "calendar"
  | "free_to_play"
  | "top_games"
  | "deals"
  | "top_liked"
  | "news_popular"
  | "news_feed";

const GX_CALENDAR_SNAPSHOT_VERSION = 1;

function parsePayload<T>(payload: unknown): T | null {
  if (payload == null) return null;
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload) as T;
    } catch {
      return null;
    }
  }
  return payload as T;
}

function hasServerSupabaseEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

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
  const cacheTable = hasServerSupabaseEnv()
    ? getServerSupabase().from("gx_cache")
    : null;

  // 1. Try live fetch
  try {
    const liveData = await liveFetcher();

    // Only cache non-empty results
    const isNonEmpty = Array.isArray(liveData) ? liveData.length > 0 : !!liveData;
    if (isNonEmpty && cacheTable) {
      // Fire and forget — don't block the response on cache write
      void (async () => {
        const { error } = await cacheTable.upsert({
          feed_key: feedKey,
          payload: liveData,
          fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (error) {
          console.warn(`[GX Cache] Failed to update cache for ${feedKey}:`, error.message);
        }
      })();
    }

    return { data: liveData, source: "live" };
  } catch (liveErr) {
    console.warn(`[GX Cache] Live fetch failed for ${feedKey}:`, (liveErr as Error).message);
  }

  // 2. Fallback to cache
  if (cacheTable) {
    try {
      const { data: cached } = await cacheTable
        .select("payload, fetched_at")
        .eq("feed_key", feedKey)
        .single() as { data: { payload: unknown; fetched_at: string } | null };

      if (cached?.payload) {
        const age = Date.now() - new Date(cached.fetched_at).getTime();
        const parsed = parsePayload<T>(cached.payload);
        if (!parsed) {
          throw new Error(`Invalid cached payload for ${feedKey}`);
        }
        const isStale = age > staleTtlMs;

        if (isStale) {
          console.warn(`[GX Cache] Serving stale cache for ${feedKey} (age: ${Math.round(age / 60000)}min)`);
        }

        return { data: parsed, source: "cache" };
      }
    } catch (cacheErr) {
      console.warn(`[GX Cache] Cache read failed for ${feedKey}:`, (cacheErr as Error).message);
    }
  }

  // 3. Both failed — return empty
  return { data: ([] as unknown) as T, source: "empty" };
}

async function readCalendarMonthSnapshot(month: string): Promise<{ items: GXCalendarGame[]; fetchedAt: string } | null> {
  if (!hasServerSupabaseEnv()) return null;
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("gx_calendar_month_snapshots")
    .select("payload, fetched_at")
    .eq("month_key", month)
    .maybeSingle() as { data: { payload: unknown; fetched_at: string } | null };

  const items = parsePayload<GXCalendarGame[]>(data?.payload);
  if (!data || !items) return null;

  return {
    items,
    fetchedAt: data.fetched_at,
  };
}

async function writeCalendarMonthSnapshot(month: string, items: GXCalendarGame[], fetchedAt: string) {
  if (!hasServerSupabaseEnv()) return;
  const supabase = getServerSupabase();
  const { error } = await supabase
    .from("gx_calendar_month_snapshots")
    .upsert({
      month_key: month,
      payload: items,
      game_count: items.length,
      source: "gx",
      snapshot_version: GX_CALENDAR_SNAPSHOT_VERSION,
      fetched_at: fetchedAt,
      updated_at: fetchedAt,
    });

  if (error) {
    console.warn(`[GX Cache] Failed to write calendar month snapshot for ${month}:`, error.message);
  }
}

export async function gxFetchCalendarMonthSnapshot(
  month: string,
  liveFetcher: () => Promise<GXCalendarEntry[]>
): Promise<GXCalendarMonthResponse> {
  if (isPastCalendarMonth(month)) {
    const existingSnapshot = await readCalendarMonthSnapshot(month);
    if (existingSnapshot) {
      return {
        month,
        items: existingSnapshot.items,
        source: "snapshot",
        fetchedAt: existingSnapshot.fetchedAt,
      };
    }
  }

  try {
    const liveEntries = await liveFetcher();
    const items = filterGXCalendarEntriesByMonth(liveEntries, month);
    const fetchedAt = new Date().toISOString();
    await writeCalendarMonthSnapshot(month, items, fetchedAt);

    return {
      month,
      items,
      source: "live",
      fetchedAt,
    };
  } catch (liveErr) {
    console.warn(`[GX Cache] Live GX calendar fetch failed for ${month}:`, (liveErr as Error).message);
  }

  const snapshot = await readCalendarMonthSnapshot(month);
  if (snapshot) {
    return {
      month,
      items: snapshot.items,
      source: "snapshot",
      fetchedAt: snapshot.fetchedAt,
    };
  }

  return {
    month,
    items: [],
    source: "empty",
  };
}
