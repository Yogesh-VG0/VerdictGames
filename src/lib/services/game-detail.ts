import { unstable_cache } from "next/cache";
import { mapGameRow } from "@/lib/db/mappers";
import {
  extractPlayStoreUrl,
  extractSteamAppId,
  getRawgGame,
  getRawgScreenshots,
  getRawgStoreLinks,
  mapRawgPlatforms,
  searchRawg,
  type RawgGameDetail,
  type RawgScreenshot,
  type RawgSearchResult,
  type RawgStoreLink,
} from "@/lib/external/rawg";
import { getPublicSupabase, hasPublicSupabaseEnv } from "@/lib/supabase/public";
import type { GameRow } from "@/lib/supabase/types";
import type { Game } from "@/lib/types";

export const GAME_DETAIL_REVALIDATE_SECONDS = 60;
export const GAME_DETAIL_API_CACHE_CONTROL = `s-maxage=${GAME_DETAIL_REVALIDATE_SECONDS}, stale-while-revalidate=300`;
export const GAME_DETAIL_RAWG_ID_HEADER = "x-verdict-game-rawg-id";
export const GAME_DETAIL_SLUG_REDIRECTS: Record<string, string> = {
  "grand-theft-aito-vi": "grand-theft-auto-vi",
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
}): Game {
  const { detail, screenshots, storeLinks } = args;
  const today = new Date().toISOString().slice(0, 10);
  const releaseDate = detail.released ?? "";
  const isUpcoming = Boolean(releaseDate && releaseDate > today);
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
    description: detail.description_raw ?? "",
    score,
    verdictLabel,
    verdictSummary: isUpcoming
      ? `${detail.name} is scheduled to launch on ${releaseDate}.`
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

async function fetchRawgPreviewRecordByRawgId(rawgId: number): Promise<PreviewGameRecord | null> {
  try {
    const detail = await getRawgGame(rawgId);
    if (!detail.slug) {
      return null;
    }

    const [screenshots, storeLinks] = await Promise.all([
      getRawgScreenshots(rawgId).catch(() => []),
      getRawgStoreLinks(rawgId).catch(() => []),
    ]);

    return {
      game: mapRawgPreviewGame({ detail, screenshots, storeLinks }),
      canonicalSlug: detail.slug,
    };
  } catch {
    return null;
  }
}

async function getCachedRawgPreviewRecordByRawgId(rawgId: number): Promise<PreviewGameRecord | null> {
  return unstable_cache(
    async () => fetchRawgPreviewRecordByRawgId(rawgId),
    ["game-detail-preview-v1", `rawg:${rawgId}`],
    { revalidate: 3600 }
  )();
}

async function fetchRawgPreviewRecordBySlug(slug: string): Promise<PreviewGameRecord | null> {
  try {
    const query = humanizePreviewSlug(slug);
    if (!query) {
      return null;
    }

    const searchResults = await searchRawg(query, 1, 5);
    const candidate = pickRawgPreviewCandidate(slug, searchResults.results);
    if (!candidate) {
      return null;
    }

    return fetchRawgPreviewRecordByRawgId(candidate.id);
  } catch {
    return null;
  }
}

async function getCachedRawgPreviewRecordBySlug(slug: string): Promise<PreviewGameRecord | null> {
  return unstable_cache(
    async () => fetchRawgPreviewRecordBySlug(slug),
    ["game-detail-preview-v1", `slug:${slug}`],
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
    const { data } = await supabase
      .from("games")
      .select("*")
      .eq("rawg_id", args.rawgId)
      .maybeSingle() as { data: GameRow | null };

    row = data;
  }

  if (!row && args.slug) {
    const { data } = await supabase
      .from("games")
      .select("*")
      .eq("slug", args.slug)
      .maybeSingle() as { data: GameRow | null };

    row = data;
  }

  if (!row) {
    return null;
  }

  let mobileListings: MobileStoreListing[] = [];

  try {
    const { data } = await supabase
      .from("mobile_store_listings")
      .select("store, store_url")
      .eq("game_id", row.id)
      .eq("is_verified", true) as { data: MobileStoreListing[] | null };

    mobileListings = data ?? [];
  } catch {
    mobileListings = [];
  }

  return { row, mobileListings };
}

async function getCachedGameRecord(args: {
  slug?: string | null;
  rawgId?: number | null;
}): Promise<CachedGameRecord | null> {
  const key = [
    "game-detail-v1",
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

export async function loadGameDetail(args: {
  slug: string;
  rawgId?: number | null;
}): Promise<GameDetailLookupResult> {
  const requestedSlug = args.slug;
  const redirectSlug = GAME_DETAIL_SLUG_REDIRECTS[requestedSlug] ?? null;
  const blockedRequestedSlug = GAME_DETAIL_BLOCKED_SLUGS.has(requestedSlug);
  const rawgId = args.rawgId != null && Number.isFinite(args.rawgId) ? args.rawgId : null;

  if (rawgId != null) {
    const record = await getCachedGameRecord({ rawgId });

    if (record) {
      const game = withVerifiedMobileStoreUrls(mapGameRow(record.row), record.mobileListings);
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
