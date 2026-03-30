import { unstable_cache } from "next/cache";
import { mapGameRow } from "@/lib/db/mappers";
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

export type GameDetailLookupResult =
  | {
      status: "ok";
      game: Game;
      requestedSlug: string;
      canonicalSlug: string;
      shouldRedirect: boolean;
      resolvedVia: "slug" | "redirect" | "rawgId";
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
