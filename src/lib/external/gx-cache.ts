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
import type { GXCalendarEntry, GXDealEntry } from "@/lib/external/gxcorner";
import type { GXCalendarGame, GXCalendarMonthResponse } from "@/lib/types";
import { measureHomepagePhase, startHomepagePhase } from "@/lib/services/homepage-timing";
import { boundedHomepageRead, currentHomepageSignal } from "@/lib/services/homepage-budget";
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

export async function readGXDealsSnapshot(): Promise<GXDealEntry[]> {
  if (!hasServerSupabaseEnv()) return [];
  const { data, error } = await measureHomepagePhase('provider_snapshot', () => getServerSupabase()
    .from('gx_cache').select('payload').eq('feed_key', 'deals')
    .abortSignal(AbortSignal.timeout(1500)).maybeSingle());
  if (error) throw error;
  const rows = parsePayload<unknown>(data?.payload);
  if (data && !Array.isArray(rows)) throw new Error('Invalid stored Deals snapshot');
  return Array.isArray(rows) ? rows : [];
}

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
  staleTtlMs = 6 * 60 * 60 * 1000,
  acceptPayload: (payload: unknown) => boolean = (payload) => Array.isArray(payload) ? payload.length > 0 : Boolean(payload)
): Promise<{ data: T; source: "live" | "cache" | "empty" }> {
  const cacheTable = hasServerSupabaseEnv()
    ? getServerSupabase().from("gx_cache")
    : null;

  // Fresh durable snapshots are the first choice. A visitor should not pay
  // upstream latency (or trigger writes) on every cache miss at the CDN.
  let stored: { data: T; source: "cache" } | null = null;
  if (cacheTable) {
    try {
      const { data, error } = await boundedHomepageRead(1400, async () => measureHomepagePhase('provider_snapshot', () =>
        cacheTable.select('payload, fetched_at').eq('feed_key', feedKey).abortSignal(currentHomepageSignal()!).maybeSingle()));
      if (error) throw error;
      const parsed = parsePayload<T>(data?.payload);
      if (data && parsed !== null && acceptPayload(parsed)) {
        const age = Date.now() - Date.parse(data.fetched_at);
        if (age >= 0 && age < staleTtlMs) return { data: parsed, source: 'cache' };
        if (age >= 0 && age < 2 * staleTtlMs) stored = { data: parsed, source: 'cache' };
      }
    } catch {
      console.warn(`[GX Cache] Snapshot read failed for ${feedKey}`);
    }
  }

  let liveData: T;
  try {
    liveData = await boundedHomepageRead(3500, () => measureHomepagePhase('provider_fetch', liveFetcher));
    if (!acceptPayload(liveData)) {
      throw new Error('Unusable provider payload');
    }
  } catch {
    console.warn(`[GX Cache] Live fetch failed for ${feedKey}`);
    const finishFallback = startHomepagePhase('provider_fallback');
    const result = stored ?? { data: [] as unknown as T, source: 'empty' as const };
    finishFallback();
    return result;
  }

  if (cacheTable) {
    try {
      const fetchedAt = new Date().toISOString();
      const { error } = await boundedHomepageRead(950, async () => cacheTable.upsert({
        feed_key: feedKey, payload: liveData, fetched_at: fetchedAt, updated_at: fetchedAt,
      }).abortSignal(currentHomepageSignal()!));
      if (error) throw error;
    } catch {
      console.warn(`[GX Cache] Snapshot write failed for ${feedKey}`);
    }
  }
  return { data: liveData, source: "live" };
}

async function readCalendarMonthSnapshot(month: string): Promise<{ items: GXCalendarGame[]; fetchedAt: string; snapshotVersion: number } | null> {
  if (!hasServerSupabaseEnv()) return null;
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("gx_calendar_month_snapshots")
    .select("payload, fetched_at, snapshot_version")
    .eq("month_key", month)
    .abortSignal(AbortSignal.timeout(1800))
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
    }).abortSignal(AbortSignal.timeout(1800));

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
