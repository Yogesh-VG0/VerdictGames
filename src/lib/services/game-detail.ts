import { unstable_cache } from "next/cache";
import { cache } from "react";
import { boundedHomepageRead } from "@/lib/services/homepage-budget";
import { mapGameRow } from "@/lib/db/mappers";
import { getReviewedReleaseTiming, readReleaseTimings } from '@/lib/services/release-timing';
import { formatReleaseTiming, resolveReleaseTiming, type ReleaseTiming } from '@/lib/utils/release-timing';
import { hasEarlyAccessSignal, hasKnownFullRelease, hasUnreleasedStatus } from '@/lib/utils/release-status';
import {
  extractPlayStoreUrl,
  extractSteamAppId,
  getRawgGame,
  RawgNotFoundError,
  getRawgScreenshots,
  getRawgStoreLinks,
  mapRawgPlatforms,
  searchRawg,
  type RawgGameDetail,
  type RawgScreenshot,
  type RawgSearchResult,
  type RawgStoreLink,
} from "@/lib/external/rawg";
import { getPublicSupabase, hasPublicSupabaseEnv, PUBLIC_SUPABASE_FETCH_TIMEOUT_MS } from "@/lib/supabase/public";
import type { GameRow } from "@/lib/supabase/types";
import {isPublicSafeGame,isPublicSafeRawgGame} from '@/lib/utils/publicSafety';
import type { Game } from "@/lib/types";

export const GAME_DETAIL_REVALIDATE_SECONDS = 3600;
export const GAME_DETAIL_API_CACHE_CONTROL = `s-maxage=${GAME_DETAIL_REVALIDATE_SECONDS}, stale-while-revalidate=300`;
export const GAME_DETAIL_RAWG_ID_HEADER = "x-verdict-game-rawg-id";
export const GAME_DETAIL_SLUG_REDIRECTS: Record<string, string> = {
  "grand-theft-aito-vi": "grand-theft-auto-vi",
  "black-myth-wu-kong": "black-myth-wukong",
};
export const GAME_DETAIL_BLOCKED_SLUGS = new Set(["grand-theft-aito-vi"]);

const VALID_SLUG_PATTERN = /^[a-z0-9-]{1,100}$/i;

type MobileStoreListing = {
  store: string;
  store_url: string | null;
};

type CachedGameRecord = {
  row: GameRow;
  mobileListings: MobileStoreListing[];
  releaseTiming?: ReleaseTiming;
};

type PreviewGameRecord = {
  game: Game;
  canonicalSlug: string;
};

export type GameDetailLookupResult =
  | {
      status: "ok";
      game: Game;
      requestedSlug: string;
      canonicalSlug: string;
      shouldRedirect: boolean;
      resolvedVia: "slug" | "redirect" | "rawgId" | "preview";
      blockedRequestedSlug: boolean;
      redirectSlug: string | null;
    }
  | {
      status: "not-found";
      requestedSlug: string;
      blockedRequestedSlug: boolean;
      redirectSlug: string | null;
    };

function withVerifiedMobileStoreUrls(game: Game, mobileListings: MobileStoreListing[]): Game {
  if (mobileListings.length === 0) {
    return game;
  }

  const nextGame = { ...game };

  for (const listing of mobileListings) {
    if (listing.store === "google_play" && listing.store_url && !nextGame.playStoreUrl) {
      nextGame.playStoreUrl = listing.store_url;
    }

    if (listing.store === "app_store" && listing.store_url && !nextGame.appStoreUrl) {
      nextGame.appStoreUrl = listing.store_url;
    }
  }

  return nextGame;
}

function normalizePreviewIdentity(value: string): string {
  return value
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function humanizePreviewSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

function pickRawgPreviewCandidate(requestedSlug: string, results: RawgSearchResult[]): RawgSearchResult | null {
  const normalizedRequestedSlug = requestedSlug.trim().toLowerCase();
  const requestedTitleKey = normalizePreviewIdentity(humanizePreviewSlug(requestedSlug));

  return results.find((result) => result.slug.trim().toLowerCase() === normalizedRequestedSlug)
    ?? results.find((result) => normalizePreviewIdentity(result.name) === requestedTitleKey)
    ?? null;
}

function mapRawgPreviewGame(args: {
  detail: RawgGameDetail;
  screenshots: RawgScreenshot[];
  storeLinks: RawgStoreLink[];
  evidence?: ReleaseTiming;
}): Game {
  const { detail, screenshots, storeLinks, evidence } = args;
  const today = new Date().toISOString().slice(0, 10);
  const releaseDate = detail.released ?? "";
  const isUpcoming = Boolean(detail.tba || releaseDate && releaseDate > today);
  const releaseTiming = resolveReleaseTiming(releaseDate, { upcoming: isUpcoming, tba: detail.tba, evidence });
  const score = isUpcoming
    ? 0
    : detail.metacritic ?? Math.round((detail.rating ?? 0) * 20);
  const verdictLabel: Game["verdictLabel"] = isUpcoming
    ? "COMING SOON"
    : score >= 80
      ? "MUST PLAY"
      : score >= 65
        ? "WORTH IT"
        : "MIXED";
  const steamAppId = extractSteamAppId(detail.stores, storeLinks) ?? undefined;
  const screenshotsList = screenshots.length > 0
    ? screenshots.map((item) => item.image).filter(Boolean)
    : (detail.short_screenshots ?? []).map((item) => item.image).filter(Boolean);

  return {
    id: `rawg-${detail.id}`,
    slug: detail.slug,
    title: detail.name,
    subtitle: detail.name_original && detail.name_original !== detail.name ? detail.name_original : undefined,
    coverImage: detail.background_image ?? detail.background_image_additional ?? screenshotsList[0] ?? "",
    headerImage: detail.background_image_additional ?? detail.background_image ?? screenshotsList[0] ?? "",
    screenshots: screenshotsList,
    platforms: mapRawgPlatforms(detail.platforms) as Game["platforms"],
    genres: (detail.genres ?? []).map((genre) => genre.name),
    tags: (detail.tags ?? []).slice(0, 8).map((tag) => tag.name),
    developer: (detail.developers ?? []).map((developer) => developer.name).join(", "),
    publisher: (detail.publishers ?? []).map((publisher) => publisher.name).join(", "),
    releaseDate,
    releaseTiming,
    releaseDateTba: releaseTiming.precision === 'tba',
    description: detail.description_raw ?? "",
    score,
    verdictLabel,
    verdictSummary: isUpcoming
      ? releaseTiming.precision === 'tba' ? `A release date for ${detail.name} is still to be announced.`
        : `Release window: ${formatReleaseTiming(releaseTiming)}.`
      : `Preview data sourced from RAWG while verdict.games builds a full tracked page for ${detail.name}.`,
    pros: [],
    cons: [],
    monetization: "Paid",
    performanceNotes: "",
    monetizationNotes: "",
    steamUrl: steamAppId ? `https://store.steampowered.com/app/${steamAppId}` : undefined,
    playStoreUrl: extractPlayStoreUrl(detail.stores, storeLinks) ?? undefined,
    steamAppId,
    reviewCount: detail.ratings_count ?? 0,
    rawgId: detail.id,
    isPreview: true,
    previewSource: "rawg",
    websiteUrl: detail.website ?? undefined,
    redditUrl: detail.reddit_url ?? undefined,
    metacriticUrl: detail.metacritic_url ?? undefined,
    rawgMetacritic: detail.metacritic ?? undefined,
    rawgRating: detail.rating ?? undefined,
    scoreSource: "rawg",
    enrichmentSources: ["rawg"],
    isProvisional: isUpcoming,
    releaseStatus: isUpcoming ? "upcoming" : undefined,
  };
}

async function fetchRawgPreviewRecord(identity: number | string): Promise<PreviewGameRecord | null> {
  try {
    const detail = await getRawgGame(identity);
    if (!detail || typeof detail.slug !== "string" || !VALID_SLUG_PATTERN.test(detail.slug)
      || typeof detail.name !== "string" || !Number.isSafeInteger(detail.id)) {
      throw new Error("Invalid RAWG game details");
    }
    if (!isPublicSafeRawgGame(detail) || !isPublicSafeGame({title:detail.name,description:detail.description_raw})) {
      return null;
    }

    const releaseIdentity = { title: detail.name };
    const upcoming = detail.tba || Boolean(detail.released && detail.released > new Date().toISOString().slice(0, 10));
    const [screenshots, storeLinks, evidence] = await Promise.all([
      boundedHomepageRead(900, () => getRawgScreenshots(detail.id)).catch(() => []),
      boundedHomepageRead(900, () => getRawgStoreLinks(detail.id)).catch(() => []),
      upcoming ? readReleaseTimings([releaseIdentity]).then(getTiming => getTiming(releaseIdentity, detail.released)) : undefined,
    ]);

    return {
      game: mapRawgPreviewGame({ detail, screenshots, storeLinks, evidence: getReviewedReleaseTiming(detail.id, detail.released, evidence) }),
      canonicalSlug: detail.slug,
    };
  } catch (error) {
    if (error instanceof RawgNotFoundError) return null;
    throw error;
  }
}

async function getCachedRawgPreviewRecordByRawgId(rawgId: number): Promise<PreviewGameRecord | null> {
  return unstable_cache(
    async () => boundedHomepageRead(4500, () => fetchRawgPreviewRecord(rawgId)),
    ["game-detail-preview-v5", `rawg:${rawgId}`],
    { revalidate: 3600 }
  )();
}

async function fetchRawgPreviewRecordBySlug(slug: string): Promise<PreviewGameRecord | null> {
  const direct = await fetchRawgPreviewRecord(slug);
  if (direct) return direct;
  const query = humanizePreviewSlug(slug);
  if (!query) return null;

  const searchResults = await searchRawg(query, 1, 5);
  const candidate = pickRawgPreviewCandidate(slug, searchResults.results);
  return candidate ? fetchRawgPreviewRecord(candidate.id) : null;
}

async function getCachedRawgPreviewRecordBySlug(slug: string): Promise<PreviewGameRecord | null> {
  return unstable_cache(
    async () => boundedHomepageRead(4500, () => fetchRawgPreviewRecordBySlug(slug)),
    ["game-detail-preview-v5", `slug:${slug}`],
    { revalidate: 3600 }
  )();
}

async function fetchGameRecord(args: {
  slug?: string | null;
  rawgId?: number | null;
}): Promise<CachedGameRecord | null> {
  if (!hasPublicSupabaseEnv()) {
    return null;
  }

  const supabase = getPublicSupabase();
  let row: GameRow | null = null;

  if (args.rawgId != null) {
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("rawg_id", args.rawgId)
      .abortSignal(AbortSignal.timeout(PUBLIC_SUPABASE_FETCH_TIMEOUT_MS))
      .maybeSingle() as { data: GameRow | null; error: unknown };

    if (error) throw error;

    row = data;
  }

  if (!row && args.slug) {
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("slug", args.slug)
      // Let the SDK see the overall deadline expire before considering a retry.
      .abortSignal(AbortSignal.timeout(PUBLIC_SUPABASE_FETCH_TIMEOUT_MS))
      .maybeSingle() as { data: GameRow | null; error: unknown };

    if (error) throw error;

    row = data;
  }

  if (!row) return null;
  if (!isPublicSafeGame(row)) return { row, mobileListings: [] };
  const identity = { title: row.title, igdbId: row.igdb_id };
  const today = new Date().toISOString().slice(0, 10);
  const reviewedTiming = getReviewedReleaseTiming(row.rawg_id, row.release_date);
  const needsReleaseEvidence = !hasKnownFullRelease(row) && (hasUnreleasedStatus(row) || row.release_status === 'early_access'
    || Boolean(reviewedTiming && hasEarlyAccessSignal(row))
    || Boolean(row.release_date && row.release_date > today));
  const releaseEvidence = needsReleaseEvidence ? readReleaseTimings([identity]) : undefined;

  let mobileListings: MobileStoreListing[] = [];

  try {
    const { data } = await supabase
      .from("mobile_store_listings")
      .select("store, store_url")
      .eq("game_id", row.id)
      .eq("is_verified", true)
      .abortSignal(AbortSignal.timeout(1600)) as { data: MobileStoreListing[] | null };

    mobileListings = data ?? [];
  } catch {
    mobileListings = [];
  }

  const evidence = getReviewedReleaseTiming(row.rawg_id, row.release_date, (await releaseEvidence)?.(identity, row.release_date));
  const releaseTiming = needsReleaseEvidence ? resolveReleaseTiming(row.release_date, {
    upcoming: true,
    tba: row.release_status === 'tba' || hasEarlyAccessSignal(row) && Boolean(row.release_date && row.release_date <= today),
    evidence,
  }) : undefined;
  return { row, mobileListings, releaseTiming };
}

async function getCachedGameRecord(args: {
  slug?: string | null;
  rawgId?: number | null;
}): Promise<CachedGameRecord | null> {
  const key = [
    "game-detail-v4",
    args.slug ?? "slug:null",
    args.rawgId != null ? `rawg:${args.rawgId}` : "rawg:null",
  ];

  return unstable_cache(
    async () => fetchGameRecord(args),
    key,
    { revalidate: GAME_DETAIL_REVALIDATE_SECONDS }
  )();
}

type RawgIdValue =
  | string
  | string[]
  | number
  | null
  | undefined
  | { rawgId?: string | string[] | number | null | undefined }
  | { get(name: string): string | null };

export function parseGameDetailRawgId(
  value: RawgIdValue
): number | null {
  if (value && typeof value === "object") {
    if ("get" in value && typeof value.get === "function") {
      return parseGameDetailRawgId(value.get("rawgId"));
    }

    if ("rawgId" in value) {
      return parseGameDetailRawgId(value.rawgId);
    }
  }

  const candidate = Array.isArray(value) ? value[0] : value;

  if (typeof candidate === "number") {
    return Number.isFinite(candidate) ? candidate : null;
  }

  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return null;
  }

  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getGameDetailRawgIdFromHeaders(
  requestHeaders: { get(name: string): string | null } | null | undefined
): number | null {
  return parseGameDetailRawgId(requestHeaders?.get(GAME_DETAIL_RAWG_ID_HEADER) ?? null);
}

async function loadGameDetailUncached(args: {
  slug: string;
  rawgId?: number | null;
}): Promise<GameDetailLookupResult> {
  const requestedSlug = args.slug;
  const redirectSlug = GAME_DETAIL_SLUG_REDIRECTS[requestedSlug] ?? null;
  const blockedRequestedSlug = GAME_DETAIL_BLOCKED_SLUGS.has(requestedSlug);
  const rawgId = args.rawgId != null && Number.isFinite(args.rawgId) ? args.rawgId : null;

  const missing = { status: "not-found" as const, requestedSlug, blockedRequestedSlug, redirectSlug };
  if (!VALID_SLUG_PATTERN.test(requestedSlug)) return missing;
  if (blockedRequestedSlug && !redirectSlug) return missing;

  if (rawgId != null && !blockedRequestedSlug && !redirectSlug) {
    const record = await getCachedGameRecord({ rawgId });

    if (record) {
      if (!isPublicSafeGame(record.row)) return missing;
      const game = withVerifiedMobileStoreUrls(mapGameRow(record.row), record.mobileListings);
      if (record.releaseTiming) game.releaseTiming = record.releaseTiming;
      return {
        status: "ok",
        game,
        requestedSlug,
        canonicalSlug: game.slug,
        shouldRedirect: game.slug !== requestedSlug,
        resolvedVia: "rawgId",
        blockedRequestedSlug,
        redirectSlug,
      };
    }
  }

  const lookupSlug = redirectSlug ?? requestedSlug;

  if (!VALID_SLUG_PATTERN.test(lookupSlug)) {
    return {
      status: "not-found",
      requestedSlug,
      blockedRequestedSlug,
      redirectSlug,
    };
  }

  const record = await getCachedGameRecord({ slug: lookupSlug });

  if (record && !isPublicSafeGame(record.row)) return missing;
  if (!record) {
    const previewRecord = rawgId != null
      ? (await getCachedRawgPreviewRecordByRawgId(rawgId)) ?? await getCachedRawgPreviewRecordBySlug(lookupSlug)
      : await getCachedRawgPreviewRecordBySlug(lookupSlug);

    if (previewRecord) {
      return {
        status: "ok",
        game: previewRecord.game,
        requestedSlug,
        canonicalSlug: previewRecord.canonicalSlug,
        shouldRedirect: previewRecord.canonicalSlug !== requestedSlug,
        resolvedVia: "preview",
        blockedRequestedSlug,
        redirectSlug,
      };
    }

    return {
      status: "not-found",
      requestedSlug,
      blockedRequestedSlug,
      redirectSlug,
    };
  }

  const game = withVerifiedMobileStoreUrls(mapGameRow(record.row), record.mobileListings);
  if (record.releaseTiming) game.releaseTiming = record.releaseTiming;

  return {
    status: "ok",
    game,
    requestedSlug,
    canonicalSlug: game.slug,
    shouldRedirect: game.slug !== requestedSlug,
    resolvedVia: redirectSlug ? "redirect" : "slug",
    blockedRequestedSlug,
    redirectSlug,
  };
}

// Metadata and the page share one lookup per render, including cache misses.
const memoizedGameDetail = cache((slug: string, rawgId?: number | null) => loadGameDetailUncached({ slug, rawgId }));
export function loadGameDetail(args: { slug: string; rawgId?: number | null }) {
  return memoizedGameDetail(args.slug, args.rawgId);
}
