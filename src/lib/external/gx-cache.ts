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
import { dedupeGXCalendarGames, filterGXCalendarEntriesByMonth, getCalendarMonthKey, isPastCalendarMonth, shouldHideGXCalendarEntry } from "@/lib/utils/gx-calendar";

type FeedKey =
  | "highlights"
  | "calendar"
  | "free_to_play"
  | "top_games"
  | "deals"
  | "top_liked"
  | "news_popular"
  | "news_feed";

const GX_CALENDAR_SNAPSHOT_VERSION = 2;

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

function isCurrentCalendarMonth(month: string): boolean {
  return month === getCalendarMonthKey();
}

function normalizeGXCalendarGame(value: unknown): GXCalendarGame | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<GXCalendarGame>;
  if (typeof item.title !== "string" || typeof item.releaseDate !== "string") {
    return null;
  }

  return {
    title: item.title,
    slug: typeof item.slug === "string" ? item.slug : null,
    cover: typeof item.cover === "string" ? item.cover : null,
    releaseDate: item.releaseDate,
    originalReleaseDate: typeof item.originalReleaseDate === "string" ? item.originalReleaseDate : null,
    hotGame: item.hotGame === true,
    url: typeof item.url === "string" ? item.url : null,
    ctaLabel: typeof item.ctaLabel === "string" ? item.ctaLabel : null,
    tagLabel: typeof item.tagLabel === "string" ? item.tagLabel : null,
    tagColor: typeof item.tagColor === "string" ? item.tagColor : null,
    genres: Array.isArray(item.genres) ? item.genres.filter((genre): genre is string => typeof genre === "string") : [],
    platforms: Array.isArray(item.platforms) ? item.platforms.filter((platform): platform is string => typeof platform === "string") : [],
  };
}

function normalizeGXCalendarPayload(payload: unknown): GXCalendarGame[] | null {
  const parsed = parsePayload<unknown>(payload);
  if (!Array.isArray(parsed)) {
    return null;
  }

  return dedupeGXCalendarGames(
    parsed
      .map(normalizeGXCalendarGame)
      .filter((item): item is GXCalendarGame => item !== null)
      .filter((item) => !shouldHideGXCalendarEntry(item))
  );
}

function getGXCalendarSnapshotKey(item: GXCalendarGame): string {
  const slug = item.slug?.trim().toLowerCase() || item.title.trim().toLowerCase();
  const releaseDate = item.releaseDate.slice(0, 10);
  const platforms = [...item.platforms].map((platform) => platform.trim().toLowerCase()).sort().join("|");
  const tag = item.tagLabel?.trim().toLowerCase() ?? "";
  const url = item.url?.trim().toLowerCase() ?? "";
  return [slug, releaseDate, platforms, tag, url].join("::");
}

function mergeGXCalendarSnapshotItems(existingItems: GXCalendarGame[], liveItems: GXCalendarGame[]): GXCalendarGame[] {
  const byKey = new Map<string, GXCalendarGame>();

  for (const item of existingItems) {
    byKey.set(getGXCalendarSnapshotKey(item), item);
  }

  for (const item of liveItems) {
    byKey.set(getGXCalendarSnapshotKey(item), item);
  }

  return Array.from(byKey.values())
    .sort((left, right) => left.releaseDate.localeCompare(right.releaseDate) || left.title.localeCompare(right.title));
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

    // An empty upstream response is treated as a failure so a good cached feed
    // is not replaced by a temporary provider outage.
    const isNonEmpty = Array.isArray(liveData) ? liveData.length > 0 : !!liveData;
    if (!isNonEmpty) {
      throw new Error(`GX returned an empty payload for ${feedKey}`);
    }

    if (cacheTable) {
      const { error } = await cacheTable.upsert({
        feed_key: feedKey,
        payload: liveData,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) {
        console.warn(`[GX Cache] Failed to update cache for ${feedKey}:`, error.message);
      }
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

async function readCalendarMonthSnapshot(month: string): Promise<{ items: GXCalendarGame[]; fetchedAt: string; snapshotVersion: number } | null> {
  if (!hasServerSupabaseEnv()) return null;
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("gx_calendar_month_snapshots")
    .select("payload, fetched_at, snapshot_version")
    .eq("month_key", month)
    .maybeSingle() as { data: { payload: unknown; fetched_at: string; snapshot_version: number | null } | null };

  const items = normalizeGXCalendarPayload(data?.payload);
  if (!data || !items) return null;

  return {
    items,
    fetchedAt: data.fetched_at,
    snapshotVersion: data.snapshot_version ?? 1,
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
  const existingSnapshot = await readCalendarMonthSnapshot(month);

  if (isPastCalendarMonth(month) && existingSnapshot && existingSnapshot.snapshotVersion >= GX_CALENDAR_SNAPSHOT_VERSION) {
    return {
      month,
      items: existingSnapshot.items,
      source: "snapshot",
      fetchedAt: existingSnapshot.fetchedAt,
    };
  }

  try {
    const liveEntries = await liveFetcher();
    const liveItems = filterGXCalendarEntriesByMonth(liveEntries, month);
    const fetchedAt = new Date().toISOString();
    const shouldMergeExistingSnapshot = Boolean(
      existingSnapshot
      && (isCurrentCalendarMonth(month) || isPastCalendarMonth(month) || existingSnapshot.snapshotVersion < GX_CALENDAR_SNAPSHOT_VERSION)
    );
    const items = shouldMergeExistingSnapshot && existingSnapshot
      ? mergeGXCalendarSnapshotItems(existingSnapshot.items, liveItems)
      : liveItems;

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

  if (existingSnapshot) {
    return {
      month,
      items: existingSnapshot.items,
      source: "snapshot",
      fetchedAt: existingSnapshot.fetchedAt,
    };
  }

  return {
    month,
    items: [],
    source: "empty",
  };
}
