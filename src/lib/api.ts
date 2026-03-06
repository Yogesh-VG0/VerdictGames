/**
 * VERDICT.GAMES — API Client
 *
 * Calls real API routes. No mock data — all data comes from Supabase.
 */

import {
  Game,
  Review,
  ReviewComment,
  User,
  UserGame,
  GameList,
  LibraryStats,
  LibraryStatus,
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

/* ═══════════════════════════════════════════════════
   LIBRARY QUERIES (Authenticated)
   ═══════════════════════════════════════════════════ */

/** Get user's game library. */
export async function getLibrary(status?: string): Promise<UserGame[]> {
  const params = status ? `?status=${status}` : "";
  return (await apiFetch<UserGame[]>(`/api/library${params}`)) ?? [];
}

/** Add or update a game in library. */
export async function updateLibraryGame(data: {
  gameId: string;
  status?: LibraryStatus;
  personalRating?: number;
  hoursPlayed?: number;
  notes?: string;
  startedAt?: string;
  completedAt?: string;
}): Promise<UserGame | null> {
  return apiFetch<UserGame>("/api/library", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Remove a game from library. */
export async function removeFromLibrary(gameId: string): Promise<boolean> {
  const result = await apiFetch<{ removed: boolean }>("/api/library", {
    method: "DELETE",
    body: JSON.stringify({ gameId }),
  });
  return result?.removed ?? false;
}

/** Get library stats. */
export async function getLibraryStats(): Promise<LibraryStats | null> {
  return apiFetch<LibraryStats>("/api/library/stats");
}

/* ═══════════════════════════════════════════════════
   REVIEW MUTATIONS (Authenticated)
   ═══════════════════════════════════════════════════ */

/** Submit a new review. */
export async function submitReview(data: {
  gameId: string;
  rating: number;
  title: string;
  bodyText: string;
  pros?: string[];
  cons?: string[];
  platform?: string;
}): Promise<{ id: string } | null> {
  return apiFetch<{ id: string }>("/api/reviews", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Vote on a review (1 = helpful, -1 = unhelpful). */
export async function voteOnReview(reviewId: string, value: 1 | -1): Promise<boolean> {
  const result = await apiFetch<{ voted: boolean }>(`/api/reviews/${reviewId}/vote`, {
    method: "POST",
    body: JSON.stringify({ value }),
  });
  return result?.voted ?? false;
}

/** Get comments for a review. */
export async function getReviewComments(reviewId: string): Promise<ReviewComment[]> {
  return (await apiFetch<ReviewComment[]>(`/api/reviews/${reviewId}/comments`)) ?? [];
}

/** Add a comment to a review. */
export async function addReviewComment(reviewId: string, body: string, parentId?: string): Promise<ReviewComment | null> {
  return apiFetch<ReviewComment>(`/api/reviews/${reviewId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body, parentId }),
  });
}

/* ═══════════════════════════════════════════════════
   FOLLOW SYSTEM
   ═══════════════════════════════════════════════════ */

/** Follow or unfollow a user. */
export async function toggleFollow(profileId: string, action: "follow" | "unfollow"): Promise<boolean> {
  const result = await apiFetch<{ following: boolean }>("/api/follow", {
    method: "POST",
    body: JSON.stringify({ targetProfileId: profileId, action }),
  });
  return result?.following ?? false;
}

/* ═══════════════════════════════════════════════════
   CALENDAR
   ═══════════════════════════════════════════════════ */

/** Get games releasing in a specific month. */
export async function getCalendarGames(month?: string): Promise<Game[]> {
  const params = month ? `?month=${month}` : "";
  return (await apiFetch<Game[]>(`/api/calendar${params}`)) ?? [];
}

/* ═══════════════════════════════════════════════════
   COMPARE
   ═══════════════════════════════════════════════════ */

/** Compare two games side by side. */
export async function compareGames(slug1: string, slug2: string): Promise<{ game1: Game; game2: Game } | null> {
  return apiFetch<{ game1: Game; game2: Game }>(`/api/compare?g1=${encodeURIComponent(slug1)}&g2=${encodeURIComponent(slug2)}`);
}

/* ═══════════════════════════════════════════════════
   RECOMMENDATIONS
   ═══════════════════════════════════════════════════ */

/** Get personalized recommendations. */
export async function getRecommendations(limit = 8): Promise<Game[]> {
  return (await apiFetch<Game[]>(`/api/recommendations?limit=${limit}`)) ?? [];
}

/* ═══════════════════════════════════════════════════
   DEVELOPERS
   ═══════════════════════════════════════════════════ */

export interface DeveloperHub {
  name: string;
  slug: string;
  gameCount: number;
  averageScore: number;
  games: Game[];
}

/** Get developer hub data. */
export async function getDeveloperHub(slug: string): Promise<DeveloperHub | null> {
  return apiFetch<DeveloperHub>(`/api/developers/${encodeURIComponent(slug)}`);
}
