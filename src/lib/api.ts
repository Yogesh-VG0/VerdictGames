/**
 * VERDICT.GAMES — API Client
 *
 * Calls real API routes. No mock data — all data comes from Supabase.
 */

import {
  Game,
  Review,
  User,
  GameList,
  SearchFilters,
  PaginatedResponse,
} from "./types";

const PAGE_SIZE = 12;

const EMPTY_PAGE = <T,>(): PaginatedResponse<T> => ({
  items: [],
  total: 0,
  page: 1,
  pageSize: PAGE_SIZE,
  hasMore: false,
});

/* ═══════════════════════════════════════════════════
   INTERNAL HELPERS
   ═══════════════════════════════════════════════════ */

/** Base URL for API calls (works in both server and client). */
function getBaseUrl(): string {
  if (typeof window !== "undefined") return "";
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Typed fetch wrapper that returns parsed data or null on failure. */
async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T | null> {
  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!res.ok) return null;

    const json = await res.json();
    if (json.success) return json.data as T;
    return null;
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════
   GAME QUERIES
   ═══════════════════════════════════════════════════ */

/** Get the featured game for the hero banner. */
export async function getFeaturedGame(): Promise<Game | null> {
  const trending = await getTrendingGames();
  return trending.find((g) => g.featured) ?? trending[0] ?? null;
}

/** Get multiple featured games for the hero carousel. */
export async function getFeaturedGames(limit = 5): Promise<Game[]> {
  const trending = await getTrendingGames();
  // Featured games first, then fill with trending
  const featured = trending.filter((g) => g.featured);
  const nonFeatured = trending.filter((g) => !g.featured);
  return [...featured, ...nonFeatured].slice(0, limit);
}

/** Get trending games. */
export async function getTrendingGames(): Promise<Game[]> {
  return (await apiFetch<Game[]>("/api/games/trending?limit=10")) ?? [];
}

/** Get newest releases (sorted by date desc). */
export async function getNewReleases(limit = 8): Promise<Game[]> {
  return (await apiFetch<Game[]>(`/api/games/new-releases?limit=${limit}`)) ?? [];
}

/** Get top-rated games. */
export async function getTopRated(limit = 8): Promise<Game[]> {
  return (await apiFetch<Game[]>(`/api/games/top-rated?limit=${limit}`)) ?? [];
}

/** Search games with filters and pagination. */
export async function searchGames(
  filters: SearchFilters
): Promise<PaginatedResponse<Game>> {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.platform && filters.platform !== "All") params.set("platform", filters.platform);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.year) params.set("year", filters.year);
  if (filters.monetization && filters.monetization !== "All") params.set("monetization", filters.monetization);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.page) params.set("page", String(filters.page));

  const data = await apiFetch<PaginatedResponse<Game>>(
    `/api/search?${params.toString()}`
  );
  return data ?? EMPTY_PAGE<Game>();
}

/** Get a single game by slug. */
export async function getGameBySlug(slug: string): Promise<Game | null> {
  return apiFetch<Game>(`/api/games/${encodeURIComponent(slug)}`);
}

/** Get related games for a given game slug. */
export async function getRelatedGames(slug: string, limit = 4): Promise<Game[]> {
  const game = await getGameBySlug(slug);
  if (!game) return [];
  const genre = game.genres[0];
  if (genre) {
    const results = await searchGames({ genre, sort: "top-rated", page: 1 });
    return results.items.filter((g) => g.slug !== slug).slice(0, limit);
  }
  return [];
}

/** "Because you viewed…" personalized — genre-diverse picks. */
export async function getPersonalizedGames(limit = 6): Promise<Game[]> {
  // Get a larger pool and pick diverse genres
  const pool = await getTopRated(30);
  const trending = await getTrendingGames();
  const trendingIds = new Set(trending.map((g) => g.id));

  // Filter out games already in trending to avoid duplicates
  const candidates = pool.filter((g) => !trendingIds.has(g.id));

  // Pick one game per genre for diversity
  const seenGenres = new Set<string>();
  const picks: Game[] = [];

  for (const game of candidates) {
    if (picks.length >= limit) break;
    const primaryGenre = game.genres[0] ?? "unknown";
    if (!seenGenres.has(primaryGenre) || seenGenres.size >= 6) {
      seenGenres.add(primaryGenre);
      picks.push(game);
    }
  }

  // If we still need more, fill from remaining
  if (picks.length < limit) {
    const pickIds = new Set(picks.map((p) => p.id));
    for (const game of candidates) {
      if (picks.length >= limit) break;
      if (!pickIds.has(game.id)) picks.push(game);
    }
  }

  return picks;
}

/* ═══════════════════════════════════════════════════
   REVIEW QUERIES
   ═══════════════════════════════════════════════════ */

/** Get reviews for a specific game. */
export async function getGameReviews(
  slug: string,
  options?: { sort?: "newest" | "helpful"; page?: number }
): Promise<PaginatedResponse<Review>> {
  const params = new URLSearchParams();
  if (options?.sort) params.set("sort", options.sort);
  if (options?.page) params.set("page", String(options.page));

  const data = await apiFetch<PaginatedResponse<Review>>(
    `/api/games/${encodeURIComponent(slug)}/reviews?${params.toString()}`
  );
  return data ?? EMPTY_PAGE<Review>();
}

/* ═══════════════════════════════════════════════════
   STEAM DATA — News & Achievements
   ═══════════════════════════════════════════════════ */

export interface SteamNewsArticle {
  id: string;
  title: string;
  url: string;
  author: string;
  contents: string;
  feedLabel: string;
  date: string;
  tags: string[];
}

export interface SteamNewsData {
  title: string;
  steamAppId?: number;
  news: SteamNewsArticle[];
  message?: string;
}

export interface SteamAchievementItem {
  name: string;
  description: string | null;
  icon: string;
  iconGray: string;
  globalUnlockPercent: number;
}

export interface SteamAchievementsData {
  title: string;
  steamAppId?: number;
  total: number;
  achievements: SteamAchievementItem[];
  message?: string;
}

/** Get latest Steam news for a game. */
export async function getGameNews(
  slug: string,
  count = 5
): Promise<SteamNewsData> {
  const data = await apiFetch<SteamNewsData>(
    `/api/games/${encodeURIComponent(slug)}/news?count=${count}`
  );
  return data ?? { title: "", news: [] };
}

/** Get Steam achievement stats for a game. */
export async function getGameAchievements(
  slug: string,
  limit = 20
): Promise<SteamAchievementsData> {
  const data = await apiFetch<SteamAchievementsData>(
    `/api/games/${encodeURIComponent(slug)}/achievements?limit=${limit}`
  );
  return data ?? { title: "", total: 0, achievements: [] };
}

/** Get the global reviews feed. */
export async function getGlobalReviews(options?: {
  sort?: "newest" | "helpful";
  platform?: "PC" | "Android" | "All";
  page?: number;
}): Promise<PaginatedResponse<Review>> {
  const params = new URLSearchParams();
  if (options?.sort) params.set("sort", options.sort);
  if (options?.platform) params.set("platform", options.platform);
  if (options?.page) params.set("page", String(options.page));

  const data = await apiFetch<PaginatedResponse<Review>>(
    `/api/reviews?${params.toString()}`
  );
  return data ?? EMPTY_PAGE<Review>();
}

/* ═══════════════════════════════════════════════════
   LIST QUERIES
   ═══════════════════════════════════════════════════ */

/** Get all curated lists. */
export async function getCuratedLists(): Promise<GameList[]> {
  return (await apiFetch<GameList[]>("/api/lists")) ?? [];
}

/** Get a single list by slug. */
export async function getListBySlug(slug: string): Promise<GameList | null> {
  return apiFetch<GameList>(`/api/lists/${encodeURIComponent(slug)}`);
}

/* ═══════════════════════════════════════════════════
   USER QUERIES
   ═══════════════════════════════════════════════════ */

/** Get a user profile. */
export async function getUserProfile(username: string): Promise<User | null> {
  return apiFetch<User>(`/api/profile/${encodeURIComponent(username)}`);
}

/** Get reviews by a specific user. */
export async function getUserReviews(username: string): Promise<Review[]> {
  const allReviews = await getGlobalReviews({ sort: "newest", page: 1 });
  return allReviews.items.filter((r) => r.username === username);
}
