import { unstable_cache } from "next/cache";
import {
  getGXDeals,
  getGXFreeToPlay,
  getGXTopGames,
  type GXDealEntry,
  type GXGameListEntry,
} from "@/lib/external/gxcorner";
import { gxFetchWithCache } from "@/lib/external/gx-cache";
import { getServerSupabase } from "@/lib/supabase/server";
import type { GXDeal, GXFreeGame, GXTopGame } from "@/lib/types";
import { slugify, titlesMatch } from "@/lib/utils/slugify";

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
    .select("slug, title, cover_image, header_image")
    .in("slug", uniqueSlugs);

  for (const game of matchingGames ?? []) {
    if (!game.slug) {
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
  const matchedGame = sourceSlug ? matchedGamesBySlug.get(sourceSlug) : undefined;

  return {
    id: entry.id,
    title: entry.game.title,
    cover: preferCanonicalCover(entry.game.imageCoverVertical?.url ?? null, matchedGame),
    gameSlug: matchedGame?.slug ?? null,
    discount: entry.game.prices?.[0]?.discount ?? null,
    price: entry.game.prices?.[0]?.price ?? null,
    currency: entry.game.prices?.[0]?.currency?.abbr ?? null,
    buyUrl: entry.game.prices?.[0]?.url ?? entry.url ?? null,
    storeName: entry.store?.name ?? null,
    storeColor: entry.store?.color ?? null,
    badge: entry.tag?.name ?? null,
    dealType: entry.dealType,
    genres: entry.game.genres.map((genre) => genre.name),
    platforms: entry.game.platforms.map((platform) => platform.name),
  };
}

function mapFreeGameEntry(entry: GXGameListEntry, matchedGamesBySlug: Map<string, GXMatchedGame>): GXFreeGame {
  const sourceSlug = entry.game.slug?.trim() ?? null;
  const matchedGame = sourceSlug ? matchedGamesBySlug.get(sourceSlug) : undefined;

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
  const { data: raw } = await gxFetchWithCache(
    "deals",
    getGXDeals
  );
  const matchedGamesBySlug = await loadMatchedGamesBySlug(
    raw.map((entry) => entry.game.slug ?? "")
  );

  return raw.map((entry) => mapDealEntry(entry, matchedGamesBySlug));
}

async function loadGXFreeToPlayUncached(): Promise<GXFreeGame[]> {
  const { data: raw } = await gxFetchWithCache(
    "free_to_play",
    getGXFreeToPlay
  );
  const matchedGamesBySlug = await loadMatchedGamesBySlug(
    raw.map((entry) => entry.game.slug ?? "")
  );

  return raw.map((entry) => mapFreeGameEntry(entry, matchedGamesBySlug));
}

async function loadGXTopGamesUncached(): Promise<GXTopGame[]> {
  const { data: raw } = await gxFetchWithCache(
    "top_games",
    getGXTopGames
  );
  const candidateSlugs = Array.from(
    new Set(
      raw.flatMap((entry) => {
        const sourceSlug = entry.game.slug?.trim();
        const titleSlug = slugify(entry.game.title);
        return [sourceSlug, titleSlug].filter((slug): slug is string => Boolean(slug));
      })
    )
  );
  const matchedGamesBySlug = await loadMatchedGamesBySlug(candidateSlugs);

  return raw.map((entry) => {
    const sourceSlug = entry.game.slug?.trim() ?? null;
    const titleSlug = slugify(entry.game.title);
    const sourceMatch = sourceSlug ? matchedGamesBySlug.get(sourceSlug) : undefined;
    const titleMatch = titleSlug ? matchedGamesBySlug.get(titleSlug) : undefined;
    const verifiedSlug = sourceMatch?.slug
      ?? (titleMatch?.title && titlesMatch(titleMatch.title, entry.game.title) ? titleMatch.slug : null);
    const matchedGame = verifiedSlug
      ? matchedGamesBySlug.get(verifiedSlug)
      : sourceMatch;

    return {
      id: entry.id,
      title: entry.game.title,
      cover: preferCanonicalCover(entry.game.imageCoverVertical?.url ?? null, matchedGame),
      gameSlug: verifiedSlug,
      url: entry.url,
      serviceName: entry.store?.name ?? null,
      serviceColor: entry.store?.color ?? null,
      serviceTag: entry.tag?.name ?? null,
      genres: entry.game.genres.map((genre) => genre.name),
      platforms: entry.game.platforms.map((platform) => platform.name),
    };
  });
}

export const loadGXDeals = unstable_cache(
  async () => loadGXDealsUncached(),
  ["gx-feeds", "deals"],
  { revalidate: GX_FEEDS_REVALIDATE_SECONDS }
);

export const loadGXFreeToPlay = unstable_cache(
  async () => loadGXFreeToPlayUncached(),
  ["gx-feeds", "free-to-play"],
  { revalidate: GX_FEEDS_REVALIDATE_SECONDS }
);

export const loadGXTopGames = unstable_cache(
  async () => loadGXTopGamesUncached(),
  ["gx-feeds", "top-games"],
  { revalidate: GX_FEEDS_REVALIDATE_SECONDS }
);
