import { unstable_cache } from "next/cache";
import { boundedHomepageRead } from "@/lib/services/homepage-budget";
import {
  getGXDeals,
  getGXFreeToPlay,
  getGXTopGames,
  type GXDealEntry,
  type GXGameListEntry,
} from "@/lib/external/gxcorner";
import { gxFetchWithCache, readGXDealsSnapshot } from "@/lib/external/gx-cache";
import { getServerSupabase } from "@/lib/supabase/server";
import type { GXDeal, GXFreeGame, GXTopGame } from "@/lib/types";
import { slugify, titlesMatch } from "@/lib/utils/slugify";
import { measureHomepagePhase } from "@/lib/services/homepage-timing";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { readGXEntitlement, readGXOffer } from '@/lib/utils/gx-offers';

export const GX_FEEDS_REVALIDATE_SECONDS = 300;
export const GX_FEEDS_API_CACHE_CONTROL = "s-maxage=300, stale-while-revalidate=3600";
export const GX_NEWS_API_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=60";

type GXMatchedGame = {
  slug: string;
  title: string | null;
  cover_image: string | null;
  header_image: string | null;
};

function hasServerSupabaseEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function preferCanonicalCover(feedCover: string | null, matchedGame?: GXMatchedGame | null): string | null {
  return matchedGame?.cover_image || matchedGame?.header_image || feedCover;
}

function isGameFeed(payload: unknown): boolean {
  return Array.isArray(payload) && payload.every(entry =>
    entry && typeof entry.id === 'string' && typeof entry.game?.title === 'string'
    && (entry.game.slug == null || typeof entry.game.slug === 'string')
    && Array.isArray(entry.game.genres) && Array.isArray(entry.game.platforms)
    && entry.game.genres.every((genre: unknown) => typeof (genre as { name?: unknown } | null)?.name === 'string')
    && entry.game.platforms.every((platform: unknown) => typeof (platform as { name?: unknown } | null)?.name === 'string'));
}

const GX_GAME_SNAPSHOT_MAX_FRESH_MS = 60 * 60 * 1000;

async function loadMatchedGamesBySlug(slugs: string[]): Promise<Map<string, GXMatchedGame>> {
  const uniqueSlugs = Array.from(
    new Set(slugs.map((slug) => slug.trim()).filter(Boolean))
  );
  const matchedGamesBySlug = new Map<string, GXMatchedGame>();

  if (!hasServerSupabaseEnv() || uniqueSlugs.length === 0) {
    return matchedGamesBySlug;
  }

  const supabase = getServerSupabase();
  const { data: matchingGames } = await supabase
    .from("games")
    .select("slug, title, description, genres, tags, cover_image, header_image")
    .in("slug", uniqueSlugs.slice(0, 240))
    .abortSignal(AbortSignal.timeout(2200));

  for (const game of matchingGames ?? []) {
    if (!game.slug || !isPublicSafeGame(game)) {
      continue;
    }

    matchedGamesBySlug.set(game.slug, {
      slug: game.slug,
      title: typeof game.title === "string" ? game.title : null,
      cover_image: typeof game.cover_image === "string" ? game.cover_image : null,
      header_image: typeof game.header_image === "string" ? game.header_image : null,
    });
  }

  return matchedGamesBySlug;
}

function mapDealEntry(entry: GXDealEntry, matchedGamesBySlug: Map<string, GXMatchedGame>): GXDeal {
  const sourceSlug = entry.game.slug?.trim() ?? null;
  const candidate = sourceSlug ? matchedGamesBySlug.get(sourceSlug) : undefined;
  const matchedGame = candidate?.title && titlesMatch(candidate.title, entry.game.title) ? candidate : undefined;

  return {
    id: entry.id,
    title: entry.game.title,
    cover: preferCanonicalCover(entry.game.imageCoverVertical?.url ?? null, matchedGame),
    gameSlug: matchedGame?.slug ?? null,
    ...readGXOffer(entry),
    badge: entry.tag?.name ?? null,
    dealType: entry.dealType,
    genres: entry.game.genres.map((genre) => genre.name),
    platforms: entry.game.platforms.map((platform) => platform.name),
  };
}

function mapFreeGameEntry(entry: GXGameListEntry, matchedGamesBySlug: Map<string, GXMatchedGame>): GXFreeGame {
  const sourceSlug = entry.game.slug?.trim() ?? null;
  const candidate = sourceSlug ? matchedGamesBySlug.get(sourceSlug) : undefined;
  const matchedGame = candidate?.title && titlesMatch(candidate.title, entry.game.title) ? candidate : undefined;

  return {
    id: entry.id,
    title: entry.game.title,
    cover: preferCanonicalCover(entry.game.imageCoverVertical?.url ?? null, matchedGame),
    gameSlug: matchedGame?.slug ?? null,
    url: entry.url,
    ctaLabel: entry.cta?.label ?? null,
    genres: entry.game.genres.map((genre) => genre.name),
    platforms: entry.game.platforms.map((platform) => platform.name),
  };
}

async function loadGXDealsUncached(): Promise<GXDeal[]> {
  const { data: raw, source } = await gxFetchWithCache(
    "deals",
    getGXDeals, GX_GAME_SNAPSHOT_MAX_FRESH_MS, isGameFeed
  );
  if (source === "empty") throw new Error("Deals feed temporarily unavailable");
  const matchedGamesBySlug = await measureHomepagePhase('candidate_hydration', () =>
    loadMatchedGamesBySlug(raw.map((entry) => entry.game.slug ?? "")));

  return raw.map((entry) => mapDealEntry(entry, matchedGamesBySlug));
}

async function loadGXFreeToPlayUncached(): Promise<GXFreeGame[]> {
  const { data: raw, source } = await gxFetchWithCache(
    "free_to_play",
    getGXFreeToPlay, GX_GAME_SNAPSHOT_MAX_FRESH_MS, isGameFeed
  );
  if (source === "empty") throw new Error("Free-to-play feed temporarily unavailable");
  const matchedGamesBySlug = await loadMatchedGamesBySlug(
    raw.map((entry) => entry.game.slug ?? "")
  );

  return raw.map((entry) => mapFreeGameEntry(entry, matchedGamesBySlug));
}

async function loadGXTopGamesUncached(): Promise<GXTopGame[]> {
  const { data: raw, source } = await gxFetchWithCache(
    "top_games",
    getGXTopGames, GX_GAME_SNAPSHOT_MAX_FRESH_MS, isGameFeed
  );
  if (source === "empty") throw new Error("Subscription feed temporarily unavailable");
  const subscriptions = raw.flatMap(entry => {
    const entitlement = readGXEntitlement(entry);
    return entitlement ? [{ entry, entitlement }] : [];
  });
  const candidateSlugs = Array.from(
    new Set(
      subscriptions.flatMap(({ entry }) => {
        const sourceSlug = entry.game.slug?.trim();
        const titleSlug = slugify(entry.game.title);
        return [sourceSlug, titleSlug].filter((slug): slug is string => Boolean(slug));
      })
    )
  );
  const matchedGamesBySlug = await loadMatchedGamesBySlug(candidateSlugs);

  return subscriptions.map(({ entry, entitlement }) => {
    const sourceSlug = entry.game.slug?.trim() ?? null;
    const titleSlug = slugify(entry.game.title);
    const sourceMatch = sourceSlug ? matchedGamesBySlug.get(sourceSlug) : undefined;
    const titleMatch = titleSlug ? matchedGamesBySlug.get(titleSlug) : undefined;
    const verifiedSlug = (sourceMatch?.title && titlesMatch(sourceMatch.title, entry.game.title) ? sourceMatch.slug : null)
      ?? (titleMatch?.title && titlesMatch(titleMatch.title, entry.game.title) ? titleMatch.slug : null);
    const matchedGame = verifiedSlug
      ? matchedGamesBySlug.get(verifiedSlug)
      : undefined;

    return {
      id: entry.id,
      title: entry.game.title,
      cover: preferCanonicalCover(entry.game.imageCoverVertical?.url ?? null, matchedGame),
      gameSlug: verifiedSlug,
      url: entry.url,
      ...entitlement,
      serviceColor: entry.store?.color ?? null,
      genres: entry.game.genres.map((genre) => genre.name),
      platforms: entry.game.platforms.map((platform) => platform.name),
    };
  });
}

export const loadGXDeals = unstable_cache(
  async () => boundedHomepageRead(8000, loadGXDealsUncached),
  ["gx-feeds-v3", "deals"],
  { revalidate: GX_FEEDS_REVALIDATE_SECONDS }
);

// The homepage can use the durable feed as-is. Dedicated Deals retains live
// refresh and canonical game-link hydration through its current entry point.
export async function loadHomepageDeals(): Promise<GXDeal[]> {
  const rows = await readGXDealsSnapshot();
  const matches = new Map<string, GXMatchedGame>();
  return rows.slice(0, 20).map(entry => mapDealEntry(entry, matches));
}

export const loadGXFreeToPlay = unstable_cache(
  async () => boundedHomepageRead(8000, loadGXFreeToPlayUncached),
  ["gx-feeds-v2", "free-to-play"],
  { revalidate: GX_FEEDS_REVALIDATE_SECONDS }
);

export const loadGXTopGames = unstable_cache(
  async () => boundedHomepageRead(8000, loadGXTopGamesUncached),
  ["gx-feeds-v3", "top-games"],
  { revalidate: GX_FEEDS_REVALIDATE_SECONDS }
);
