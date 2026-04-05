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
  Platform,
  SearchFilters,
  PaginatedResponse,
  GXDeal,
  GXNewsItem,
  GXTopGame,
  GXFreeGame,
  GXMostLiked,
  GXCalendarMonthResponse,
  CalendarMonthResponse,
} from "./types";
import { buildCalendarApiPath, getCalendarMonthKey, resolveCalendarMonthKey } from "./utils/gx-calendar";
import { buildSearchApiPath } from "@/lib/search";

/** Must match `PAGE_SIZE` in `src/app/api/search/route.ts` */
const PAGE_SIZE = 24;

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
      credentials: "include",
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

async function apiFetchOrThrow<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const data = await apiFetch<T>(path, options);
  if (data === null) {
    throw new Error(`Failed to fetch ${path}`);
  }

  return data;
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

/* ═══════════════════════════════════════════════════
   HOMEPAGE AGGREGATOR
   ═══════════════════════════════════════════════════ */

export interface HomepageData {
  hero: Game[];        // carousel candidates — distinct from trending rail
  trending: Game[];    // trending rail — pre-deduped against hero server-side
  topRated: Game[];
  newReleases: Game[];
  deals: GXDeal[];
  recommendations: Game[];  // anonymous recommendations — bundled to avoid extra API call
}

/** Fetch all homepage sections in a single call. */
export async function getHomepageData(): Promise<HomepageData> {
  return apiFetchOrThrow<HomepageData>("/api/homepage");
}

/** Search games with filters and pagination. */
export async function searchGames(
  filters: SearchFilters
): Promise<PaginatedResponse<Game>> {
  return apiFetchOrThrow<PaginatedResponse<Game>>(buildSearchApiPath(filters));
}

/** Get a single game by slug. Pass rawgId for RAWG-sourced links to avoid slug collisions. */
export async function getGameBySlug(slug: string, rawgId?: number): Promise<Game | null> {
  const params = rawgId ? `?rawgId=${rawgId}` : "";
  return apiFetch<Game>(`/api/games/${encodeURIComponent(slug)}${params}`);
}

/** Get related games for a given game slug. */
export async function getRelatedGames(slug: string, limit = 4): Promise<Game[]> {
  const params = new URLSearchParams();
  if (limit > 0) {
    params.set("limit", String(limit));
  }

  const suffix = params.toString();
  return (await apiFetch<Game[]>(`/api/games/${encodeURIComponent(slug)}/related${suffix ? `?${suffix}` : ""}`)) ?? [];
}

/** "You Might Enjoy" — recent high-quality genre-diverse picks (anonymous users). */
export async function getPersonalizedGames(limit = 12, trendingCache?: Game[]): Promise<Game[]> {
  // Use the recommendations endpoint which now has recency gates
  const recs = await getRecommendations(limit);
  if (recs.length > 0) {
    const trending = trendingCache ?? [];
    const trendingIds = new Set(trending.map((g) => g.id));
    return recs.filter((g) => !trendingIds.has(g.id)).slice(0, limit);
  }
  return recs;
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

/** Editorial review from site editors */
export interface EditorialReview {
  id: string;
  title: string | null;
  content: string;
  score: number | null;
  verdict_label: string | null;
  pros: string[];
  cons: string[];
  playtime_hours: number | null;
  platform_played: string | null;
  version_reviewed: string | null;
  is_featured: boolean;
  published_at: string | null;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

/** Get editorial reviews for a game. */
export async function getEditorialReviews(slug: string): Promise<EditorialReview[]> {
  const data = await apiFetch<{ reviews: EditorialReview[] }>(
    `/api/games/${encodeURIComponent(slug)}/editorial`
  );
  return data?.reviews ?? [];
}

/** Editorial review with game data for the reviews page. */
export interface EditorialReviewWithGame extends EditorialReview {
  games: {
    id: string;
    title: string;
    slug: string;
    cover_image: string;
    developer: string;
    release_date: string | null;
  };
}

/** Get all published editorial reviews. */
export async function getAllEditorialReviews(page: number = 1): Promise<{
  reviews: EditorialReviewWithGame[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const data = await apiFetch<{
    reviews: EditorialReviewWithGame[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/api/editorial-reviews?page=${page}`);
  return data ?? { reviews: [], total: 0, page: 1, pageSize: 20 };
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

/** Get system requirements from Steam for a game. */
export interface SystemRequirementsData {
  title?: string;
  steamAppId?: number;
  requirements: {
    pc?: { minimum?: Record<string, string>; recommended?: Record<string, string> };
    mac?: { minimum?: Record<string, string>; recommended?: Record<string, string> };
    linux?: { minimum?: Record<string, string>; recommended?: Record<string, string> };
  } | null;
  message?: string;
}

export async function getSystemRequirements(
  slug: string
): Promise<SystemRequirementsData> {
  const data = await apiFetch<SystemRequirementsData>(
    `/api/games/${encodeURIComponent(slug)}/system-requirements`
  );
  return data ?? { requirements: null };
}

/** Get the global reviews feed. */
export async function getGlobalReviews(options?: {
  sort?: "newest" | "helpful";
  platform?: Platform | "All";
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
   STEAM PLAYER REVIEWS
   ═══════════════════════════════════════════════════ */

export interface SteamPlayerReview {
  id: string;
  recommendationId: string;
  votedUp: boolean;
  reviewText: string;
  playtimeAtReview: number;
  playtimeForever: number;
  authorSteamId: string | null;
  authoredAt: string | null;
  votesUp: number;
  votesFunny: number;
  weightedVoteScore: number;
  steamPurchase: boolean;
}

export interface SteamReviewsData {
  reviews: SteamPlayerReview[];
  total: number;
  steamAppId: number | null;
  gameTitle?: string | null;
  coverImage?: string | null;
  source?: string;
  message?: string;
  cache?: {
    fetchedAt: string | null;
    ageMs: number | null;
    ttlMs: number;
    isStale: boolean;
  };
}

/** Get top Steam player reviews for a game. */
export async function getSteamReviews(
  slug: string,
  limit = 3
): Promise<SteamReviewsData> {
  const data = await apiFetch<SteamReviewsData>(
    `/api/games/${encodeURIComponent(slug)}/steam-reviews?limit=${limit}`
  );
  return data ?? { reviews: [], total: 0, steamAppId: null };
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
  return (await apiFetch<Review[]>(`/api/profile/${encodeURIComponent(username)}/reviews`)) ?? [];
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

/** Vote on a review (1 = helpful, -1 = unhelpful). Returns updated counts. */
export interface VoteResult {
  voted: boolean;
  userVote: number | null;
  helpful: number;
  notHelpful: number;
}

export async function voteOnReview(reviewId: string, value: 1 | -1): Promise<VoteResult | null> {
  return apiFetch<VoteResult>(`/api/reviews/${reviewId}/vote`, {
    method: "POST",
    body: JSON.stringify({ value }),
  });
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
export async function getCalendarGames(month?: string): Promise<CalendarMonthResponse> {
  const resolvedMonth = resolveCalendarMonthKey(month) ?? getCalendarMonthKey();
  return (await apiFetch<CalendarMonthResponse>(buildCalendarApiPath(month))) ?? {
    month: resolvedMonth,
    items: [],
    gxSource: "empty",
    gxCount: 0,
    dbCount: 0,
  };
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

/* ═══════════════════════════════════════════════════
   UPCOMING GAMES
   ═══════════════════════════════════════════════════ */

/** Get upcoming games (future release dates) — GX calendar first, DB backup. */
export async function getUpcomingGames(limit = 12): Promise<Game[]> {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const calendar = await getCalendarGames(month);
  const upcoming = calendar.items.filter((g) => {
    if (!g.releaseDate) return true;
    return new Date(g.releaseDate) >= now;
  });
  return upcoming.slice(0, limit);
}

/* ═══════════════════════════════════════════════════
   TOP GAMES BY PLATFORM
   ═══════════════════════════════════════════════════ */

/** Get top rated games filtered by platform. */
export async function getTopByPlatform(platform: Platform | "All", limit = 12): Promise<Game[]> {
  const results = await searchGames({
    platform,
    sort: "top-rated",
    page: 1,
  });
  return results.items.slice(0, limit);
}

/* ═══════════════════════════════════════════════════
   DATABASE STATS
   ═══════════════════════════════════════════════════ */

export interface SiteStats {
  totalGames: number;
  totalReviews: number;
  totalUsers: number;
  enrichmentSources: number;
}

/** Get site-wide statistics. */
export async function getSiteStats(): Promise<SiteStats> {
  return (await apiFetch<SiteStats>("/api/games/stats")) ?? { totalGames: 0, totalReviews: 0, totalUsers: 0, enrichmentSources: 5 };
}

/* ═══════════════════════════════════════════════════
   GX CORNER — Live feeds (no DB, refreshed every 5 min)
   ═══════════════════════════════════════════════════ */

export async function getGXDeals(): Promise<GXDeal[]> {
  return (await apiFetch<GXDeal[]>("/api/gx/deals")) ?? [];
}

export async function getGXPopularNews(): Promise<GXNewsItem[]> {
  return (await apiFetch<GXNewsItem[]>("/api/gx/news/popular")) ?? [];
}

export async function getGXNewsFeed(): Promise<GXNewsItem[]> {
  return (await apiFetch<GXNewsItem[]>("/api/gx/news/feed")) ?? [];
}

export async function getGXTopGames(): Promise<GXTopGame[]> {
  return (await apiFetch<GXTopGame[]>("/api/gx/top-games?v=2", { cache: "no-store" })) ?? [];
}

export async function getGXFreeToPlay(): Promise<GXFreeGame[]> {
  return (await apiFetch<GXFreeGame[]>("/api/gx/free-to-play")) ?? [];
}

export async function getGXTopLiked(): Promise<GXMostLiked[]> {
  return (await apiFetch<GXMostLiked[]>("/api/gx/top-liked")) ?? [];
}

export async function getGXCalendar(month?: string): Promise<GXCalendarMonthResponse> {
  const params = month ? `?month=${month}` : "";
  return (await apiFetch<GXCalendarMonthResponse>(`/api/gx/calendar${params}`)) ?? {
    month: month ?? getCalendarMonthKey(),
    items: [],
    source: "empty",
  };
}

/* ═══════════════════════════════════════════════════
   RAWG CURATED LISTS
   ═══════════════════════════════════════════════════ */

export interface RawgListGameItem {
  rawgId: number;
  slug: string;
  name: string;
  released: string | null;
  tba: boolean;
  image: string | null;
  rating: number;
  ratingsCount: number;
  metacritic: number | null;
  added: number;
  toplay: number;
  playing: number;
  owned: number;
  platforms: string[];
  genres: string[];
  screenshots: string[];
  clip: string | null;
}

export interface RawgListResponse {
  count: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  items: RawgListGameItem[];
}

export type RawgListType = "best-of-year" | "popular-in-year" | "all-time" | "recent" | "genre";

export async function getRawgList(
  type: RawgListType,
  opts: { page?: number; pageSize?: number; year?: number; genre?: string } = {}
): Promise<RawgListResponse> {
  const params = new URLSearchParams({ type });
  if (opts.page) params.set("page", String(opts.page));
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
  if (opts.year) params.set("year", String(opts.year));
  if (opts.genre) params.set("genre", opts.genre);

  return (await apiFetch<RawgListResponse>(`/api/rawg/lists?${params}`)) ?? {
    count: 0, page: 1, pageSize: 20, hasNext: false, items: [],
  };
}
