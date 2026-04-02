import { unstable_cache } from "next/cache";
import { searchGamesStateToFilters, type SearchGamesState } from "@/lib/search";
import { GAME_CARD_COLUMNS_WITH_DESC } from "@/lib/db/columns";
import { mapGameRow } from "@/lib/db/mappers";
import { getPublicSupabase, hasPublicSupabaseEnv } from "@/lib/supabase/public";
import type { Game, PaginatedResponse, Platform } from "@/lib/types";
import type { GameRow } from "@/lib/supabase/types";
import { hasUsableCardImage } from "@/lib/utils/mediaReadiness";
import { isPrimaryDiscoveryGame } from "@/lib/utils/discovery";
import { getPublicTrendingScore, hasBrowseTrendingSignal } from "@/lib/utils/trending";
import {
  confidenceWeightedScore,
  getCriticSourceCount,
  getEvidenceReviewCount,
  getNewReleaseDiscoveryScore,
  isQualityGame,
  isSurfaceReady,
} from "@/lib/utils/quality";
import { dedupePublicCanonicalRows } from "@/lib/utils/publicCanonical";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { normalizeTitle } from "@/lib/utils/slugify";
import { isFutureDate } from "@/lib/utils";

export const SEARCH_REVALIDATE_SECONDS = 30;
export const SEARCH_API_CACHE_CONTROL = `s-maxage=${SEARCH_REVALIDATE_SECONDS}, stale-while-revalidate=300`;
export const SEARCH_PAGE_SIZE = 25;

export function createEmptySearchResult(page: number): PaginatedResponse<Game> {
  return {
    items: [],
    total: 0,
    page,
    pageSize: SEARCH_PAGE_SIZE,
    hasMore: false,
    totalIsExact: true,
  };
}

function titleSimilarity(query: string, title: string): number {
  const q = query.toLowerCase().trim();
  const t = title.toLowerCase().trim();

  if (q === t) return 1.0;
  if (t.startsWith(q)) return 0.9 + Math.min(0.09, (q.length / t.length) * 0.09);
  if (q.startsWith(t)) return 0.85 + Math.min(0.09, (t.length / q.length) * 0.09);

  const qWords = q.split(/\s+/);
  const tWords = t.split(/\s+/);
  const allQueryWordsInTitle = qWords.every((qw) => tWords.some((tw) => tw.includes(qw)));

  if (allQueryWordsInTitle) {
    const wordOverlap = qWords.length / Math.max(tWords.length, 1);
    return 0.7 + Math.min(0.19, wordOverlap * 0.19);
  }

  if (t.includes(q)) {
    const lengthRatio = q.length / t.length;
    return 0.5 + Math.min(0.19, lengthRatio * 0.19);
  }

  const matchingWords = qWords.filter((qw) => tWords.some((tw) => tw.includes(qw) || qw.includes(tw)));
  if (matchingWords.length > 0) {
    return 0.1 + (matchingWords.length / qWords.length) * 0.3;
  }

  return 0;
}

function hasTrendingSearchSignal(row: GameRow): boolean {
  return hasBrowseTrendingSignal(row);
}

function passesBrowseDiscoveryFloor(row: GameRow): boolean {
  const reviewCount = getEvidenceReviewCount(row);
  const confidence = row.confidence ?? 0;
  const currentPlayers = row.current_players ?? 0;
  const qualityScore = confidenceWeightedScore(row);

  if (qualityScore < 74) {
    return false;
  }

  return reviewCount >= 50 || confidence >= 0.25 || currentPlayers >= 150 || qualityScore >= 84;
}

function getDateAgeDays(value: string | null | undefined): number {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00Z`
    : /^\d{4}$/.test(value)
      ? `${value}-01-01T00:00:00Z`
      : value;
  const timestamp = new Date(normalizedValue).getTime();
  if (!Number.isFinite(timestamp)) {
    return Number.POSITIVE_INFINITY;
  }

  return (Date.now() - timestamp) / 86400000;
}

function getBrowseRelevanceDiscoveryScore(row: GameRow): number {
  const qualityScore = confidenceWeightedScore(row);
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = row.current_players ?? 0;
  const momentum = Math.max(0, row.momentum ?? 0);
  const ageDays = getDateAgeDays(row.release_date);
  const freshness = ageDays <= 180
    ? 10
    : ageDays <= 365
      ? 8
      : ageDays <= 730
        ? 5
        : ageDays <= 1825
          ? 2
          : 0;

  return qualityScore
    + freshness
    + Math.min(10, Math.log10(evidenceReviewCount + 1) * 2.8)
    + Math.min(8, Math.log10(currentPlayers + 1) * 2.2)
    + Math.min(6, momentum * 22);
}

function passesRecentlyAddedDiscoveryFloor(row: GameRow): boolean {
  const qualityScore = confidenceWeightedScore(row);
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = row.current_players ?? 0;
  const releaseAgeDays = getDateAgeDays(row.release_date);

  if (!isPrimaryDiscoveryGame(row)) {
    return false;
  }

  if (qualityScore < 68) {
    return false;
  }

  if (releaseAgeDays > 365 * 5) {
    return false;
  }

  if (releaseAgeDays > 365 * 3 && qualityScore < 82 && evidenceReviewCount < 5000) {
    return false;
  }

  return evidenceReviewCount >= 20 || currentPlayers >= 50 || qualityScore >= 78;
}

function getRecentlyAddedDiscoveryScore(row: GameRow): number {
  const createdAgeDays = getDateAgeDays(row.created_at);
  const releaseAgeDays = getDateAgeDays(row.release_date);
  const qualityScore = confidenceWeightedScore(row);
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = row.current_players ?? 0;
  const addedFreshness = createdAgeDays <= 7
    ? 24
    : createdAgeDays <= 30
      ? 20
      : createdAgeDays <= 90
        ? 14
        : createdAgeDays <= 180
          ? 8
          : 2;
  const releaseFreshness = releaseAgeDays <= 180
    ? 18
    : releaseAgeDays <= 365
      ? 14
      : releaseAgeDays <= 365 * 3
        ? 9
        : releaseAgeDays <= 365 * 5
          ? 4
          : -18;

  return qualityScore
    + addedFreshness
    + releaseFreshness
    + Math.min(8, Math.log10(evidenceReviewCount + 1) * 2.3)
    + Math.min(6, Math.log10(currentPlayers + 1) * 1.8);
}

function getUpcomingMetadataScore(row: GameRow): number {
  const hasCredits = Boolean(row.developer?.trim() || row.publisher?.trim());
  const hasPlatforms = (row.platforms?.length ?? 0) > 0;
  const hasGenres = (row.genres?.length ?? 0) > 0;
  const hasDescription = Boolean(row.description && row.description.length >= 20);

  return Number(hasCredits) + Number(hasPlatforms) + Number(hasGenres) + Number(hasDescription);
}

function isUpcomingDiscoveryReady(row: GameRow): boolean {
  const hasCredits = Boolean(row.developer?.trim() || row.publisher?.trim());
  const hasPlatforms = (row.platforms?.length ?? 0) > 0;

  return Boolean(row.release_date && isFutureDate(row.release_date))
    && isPrimaryDiscoveryGame(row)
    && getUpcomingMetadataScore(row) >= 2
    && (hasCredits || hasPlatforms);
}

async function fetchSearchResults(state: SearchGamesState): Promise<PaginatedResponse<Game>> {
  const { query: q, platform, genre, year, monetization, sort, page } = state;

  if (!hasPublicSupabaseEnv()) {
    return createEmptySearchResult(page);
  }

  const supabase = getPublicSupabase();
  let query = supabase.from("games").select(GAME_CARD_COLUMNS_WITH_DESC);

  if (q) {
    query = query.or(`title.ilike.%${q}%,developer.ilike.%${q}%,publisher.ilike.%${q}%`);
  }

  if (platform && platform !== "All") {
    const platformFamilies: Record<string, string[]> = {
      "PlayStation 5": ["PlayStation 5", "PlayStation 4"],
      "Xbox Series X|S": ["Xbox Series X|S", "Xbox One"],
      "Nintendo Switch": ["Nintendo Switch", "Nintendo Switch 2"],
    };
    const platformAliases: Record<string, string> = {
      playstation: "PlayStation 5",
      ps5: "PlayStation 5",
      ps4: "PlayStation 5",
      xbox: "Xbox Series X|S",
      switch: "Nintendo Switch",
      mac: "macOS",
      macos: "macOS",
    };
    const resolvedPlatform = platformAliases[platform.toLowerCase()] ?? platform;
    const mobileStoreMap: Record<string, string> = {
      Android: "google_play",
      iOS: "app_store",
    };
    const storeName = mobileStoreMap[resolvedPlatform];

    if (storeName) {
      const { data: verifiedIds } = await supabase
        .from("mobile_store_listings")
        .select("game_id")
        .eq("store", storeName)
        .eq("is_verified", true);

      if (verifiedIds && verifiedIds.length > 0) {
        query = query.in("id", verifiedIds.map((row: { game_id: string }) => row.game_id));
      } else {
        query = query.contains("platforms", [resolvedPlatform]);
      }
    } else {
      const family = platformFamilies[resolvedPlatform];
      if (family) {
        query = query.or(family.map((candidate) => `platforms.cs.{${candidate}}`).join(","));
      } else {
        query = query.contains("platforms", [resolvedPlatform]);
      }
    }
  }

  if (genre) {
    query = query.contains("genres", [genre]);
  }

  if (year) {
    query = query.gte("release_date", `${year}-01-01`).lte("release_date", `${year}-12-31`);
  }

  if (monetization && monetization !== "All") {
    query = query.eq("monetization", monetization);
  }

  const today = new Date().toISOString().slice(0, 10);
  const recentlyAddedReleaseCutoff = new Date();
  recentlyAddedReleaseCutoff.setFullYear(recentlyAddedReleaseCutoff.getFullYear() - 5);
  const recentlyAddedReleaseCutoffStr = recentlyAddedReleaseCutoff.toISOString().slice(0, 10);
  switch (sort) {
    case "newest":
      query = query
        .lte("release_date", today)
        .not("cover_image", "is", null)
        .neq("cover_image", "")
        .or("is_provisional.is.null,is_provisional.eq.false")
        .neq("verdict_label", "COMING SOON")
        .order("release_date", { ascending: false })
        .order("id", { ascending: true });
      break;
    case "upcoming":
      query = query
        .gt("release_date", today)
        .not("cover_image", "is", null)
        .neq("cover_image", "")
        .order("release_date", { ascending: true })
        .order("id", { ascending: true });
      break;
    case "recently-added":
      query = query
        .not("release_date", "is", null)
        .gte("release_date", recentlyAddedReleaseCutoffStr)
        .lte("release_date", today)
        .not("cover_image", "is", null)
        .neq("cover_image", "")
        .gt("score", 0)
        .or("is_provisional.is.null,is_provisional.eq.false")
        .neq("verdict_label", "COMING SOON")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true });
      break;
    case "top-rated":
      query = query
        .not("cover_image", "is", null)
        .neq("cover_image", "")
        .order("verdict_score", { ascending: false, nullsFirst: false })
        .order("confidence", { ascending: false, nullsFirst: false })
        .order("score", { ascending: false })
        .order("id", { ascending: true });
      break;
    case "trending":
      query = query
        .not("cover_image", "is", null)
        .neq("cover_image", "")
        .order("is_trending_manual", { ascending: false, nullsFirst: false })
        .order("trending", { ascending: false, nullsFirst: false })
        .order("current_players", { ascending: false, nullsFirst: false })
        .order("momentum", { ascending: false, nullsFirst: false })
        .order("verdict_score", { ascending: false, nullsFirst: false })
        .order("review_count", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true });
      break;
    default:
      if (q) {
        query = query
          .order("verdict_score", { ascending: false, nullsFirst: false })
          .order("score", { ascending: false })
          .order("id", { ascending: true });
      } else {
        query = query
          .gte("review_count", 10)
          .gte("score", 55)
          .not("cover_image", "is", null)
          .neq("cover_image", "")
          .order("trending", { ascending: false, nullsFirst: false })
          .order("verdict_score", { ascending: false, nullsFirst: false })
          .order("release_date", { ascending: false })
          .order("id", { ascending: true });
      }
      break;
  }

  const isRelevanceWithQuery = sort === "relevance" && Boolean(q);
  const isTopRated = sort === "top-rated";
  const isTrendingSort = sort === "trending";
  const isNewest = sort === "newest";
  const isUpcoming = sort === "upcoming";
  const isRecentlyAdded = sort === "recently-added";
  const start = (page - 1) * SEARCH_PAGE_SIZE;
  const overfetchMultiplier = 5;

  let requestedLimit = 0;
  if (isRelevanceWithQuery) {
    requestedLimit = 150;
    query = query.range(0, requestedLimit - 1);
  } else if (isTopRated) {
    requestedLimit = Math.max(start + (SEARCH_PAGE_SIZE * overfetchMultiplier * 4), 400);
    query = query.range(0, requestedLimit - 1);
  } else if (isTrendingSort) {
    requestedLimit = Math.max(start + (SEARCH_PAGE_SIZE * overfetchMultiplier * 6), 750);
    query = query.range(0, requestedLimit - 1);
  } else if (isRecentlyAdded) {
    requestedLimit = Math.max(start + (SEARCH_PAGE_SIZE * overfetchMultiplier * 12), 1200);
    query = query.range(0, requestedLimit - 1);
  } else if (isNewest || isUpcoming || isRecentlyAdded) {
    requestedLimit = Math.max(start + (SEARCH_PAGE_SIZE * overfetchMultiplier * 4), 300);
    query = query.range(0, requestedLimit - 1);
  } else {
    requestedLimit = Math.max(start + (SEARCH_PAGE_SIZE * overfetchMultiplier), 150);
    query = query.range(0, requestedLimit - 1);
  }

  const { data, error } = await query as unknown as { data: GameRow[] | null; error: unknown };
  if (error) {
    throw error;
  }

  const returnedCount = data?.length ?? 0;
  let totalIsExact = returnedCount < requestedLimit;

  const justReleasedDays = 14;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMs = new Date(`${todayStr}T00:00:00`).getTime();
  const isTrending = isTrendingSort;
  const isBroadDiscovery = !q && (isTopRated || isTrending || sort === "relevance" || isNewest || isUpcoming || isRecentlyAdded);

  let rows = (data ?? []).filter((row) => {
    if (!isPublicSafeGame(row) || !hasUsableCardImage(row)) {
      return false;
    }

    if (isBroadDiscovery && !isPrimaryDiscoveryGame(row)) {
      return false;
    }

    if (isUpcoming) {
      return isUpcomingDiscoveryReady(row);
    }

    if ((row as GameRow & { is_provisional?: boolean }).is_provisional) {
      return false;
    }

    if (row.verdict_label === "COMING SOON") {
      return false;
    }

    if (isFutureDate(row.release_date)) {
      return false;
    }

    const reviewCount = row.review_count ?? 0;
    if (reviewCount === 0 && row.release_date) {
      const normalizedReleaseDate = /^\d{4}-\d{2}-\d{2}$/.test(row.release_date)
        ? `${row.release_date}T00:00:00Z`
        : /^\d{4}$/.test(row.release_date)
          ? `${row.release_date}-01-01T00:00:00Z`
          : row.release_date;
      const releaseMs = new Date(normalizedReleaseDate).getTime();
      if (Number.isNaN(releaseMs)) {
        return false;
      }
      const daysSinceRelease = (todayMs - releaseMs) / 86400000;
      if (daysSinceRelease > justReleasedDays) {
        return false;
      }
    }

    if (isTopRated && !isQualityGame(row, "topRated")) {
      return false;
    }

    if (isTrending && !isQualityGame(row, "trending")) {
      return false;
    }

    if (isTrending && !hasTrendingSearchSignal(row)) {
      return false;
    }

    if (isNewest && !isQualityGame(row, "newReleases")) {
      return false;
    }

    if (isRecentlyAdded && !passesRecentlyAddedDiscoveryFloor(row)) {
      return false;
    }

    if (sort === "relevance" && !q && !passesBrowseDiscoveryFloor(row)) {
      return false;
    }

    return true;
  });

  rows = dedupePublicCanonicalRows(rows, { query: q });

  if (isTrending && rows.length > 0) {
    rows.sort((left, right) => getPublicTrendingScore(right) - getPublicTrendingScore(left));
  } else if (isNewest && rows.length > 0) {
    rows.sort((left, right) => {
      const releaseDiff = (right.release_date ?? "").localeCompare(left.release_date ?? "");
      if (releaseDiff !== 0) return releaseDiff;
      const launchDiff = getNewReleaseDiscoveryScore(right) - getNewReleaseDiscoveryScore(left);
      if (launchDiff !== 0) return launchDiff;
      const reviewDiff = getEvidenceReviewCount(right) - getEvidenceReviewCount(left);
      if (reviewDiff !== 0) return reviewDiff;
      return (right.current_players ?? 0) - (left.current_players ?? 0);
    });
  } else if (isRecentlyAdded && rows.length > 0) {
    rows.sort((left, right) => {
      const scoreDiff = getRecentlyAddedDiscoveryScore(right) - getRecentlyAddedDiscoveryScore(left);
      if (scoreDiff !== 0) return scoreDiff;
      const createdDiff = (right.created_at ?? "").localeCompare(left.created_at ?? "");
      if (createdDiff !== 0) return createdDiff;
      return (right.release_date ?? "").localeCompare(left.release_date ?? "");
    });
  } else if (isUpcoming && rows.length > 0) {
    rows.sort((left, right) => {
      const releaseDiff = (left.release_date ?? "").localeCompare(right.release_date ?? "");
      if (releaseDiff !== 0) return releaseDiff;
      const metadataDiff = getUpcomingMetadataScore(right) - getUpcomingMetadataScore(left);
      if (metadataDiff !== 0) return metadataDiff;
      const qualityDiff = confidenceWeightedScore(right) - confidenceWeightedScore(left);
      if (qualityDiff !== 0) return qualityDiff;
      return getEvidenceReviewCount(right) - getEvidenceReviewCount(left);
    });
  } else if (sort === "relevance" && !q && rows.length > 0) {
    rows.sort((left, right) => getBrowseRelevanceDiscoveryScore(right) - getBrowseRelevanceDiscoveryScore(left));
  }

  let filteredTotal = rows.length;
  if (isRelevanceWithQuery && rows.length > 0) {
    const scored = rows.map((row) => {
      const similarity = titleSimilarity(q, row.title);
      const quality = Math.min(1, confidenceWeightedScore(row) / 100);
      const volume = Math.min(1, Math.log10((row.review_count ?? 0) + 1) / 6);
      const ageMs = row.release_date ? Date.now() - new Date(row.release_date).getTime() : Number.POSITIVE_INFINITY;
      const ageDays = ageMs / 86400000;
      const recency = ageDays < 365 ? 1 : ageDays < 730 ? 0.8 : ageDays < 1825 ? 0.6 : 0.3;
      const readiness = isSurfaceReady(row, "searchResult") ? 0.05 : 0;
      const relevance = (similarity * 0.5) + (quality * 0.25) + (volume * 0.15) + (recency * 0.1) + readiness;
      return { row, relevance };
    });

    scored.sort((left, right) => right.relevance - left.relevance);
    filteredTotal = scored.length;
    rows = scored.slice(start, start + SEARCH_PAGE_SIZE).map((entry) => entry.row);
  }

  if (isTopRated && rows.length > 0) {
    rows.sort((left, right) => {
      const scoreDiff = confidenceWeightedScore(right) - confidenceWeightedScore(left);
      if (scoreDiff !== 0) return scoreDiff;
      const reviewDiff = getEvidenceReviewCount(right) - getEvidenceReviewCount(left);
      if (reviewDiff !== 0) return reviewDiff;
      const criticDiff = getCriticSourceCount(right) - getCriticSourceCount(left);
      if (criticDiff !== 0) return criticDiff;
      return (right.current_players ?? 0) - (left.current_players ?? 0);
    });
    rows = rows.slice(start, start + SEARCH_PAGE_SIZE);
  }

  if (!isRelevanceWithQuery && !isTopRated) {
    rows = rows.slice(start, start + SEARCH_PAGE_SIZE);
  }

  const games = rows.map(mapGameRow);
  let total = filteredTotal;

  const noFilters = platform === "All" && !genre && !year && monetization === "All";
  if (total < 3 && q.length >= 2 && page === 1 && noFilters) {
    try {
      const { searchRawg, mapRawgPlatforms } = await import("@/lib/external/rawg");
      const rawgResults = await searchRawg(q, 1, 5);
      const existingSlugs = new Set(games.map((game) => normalizeTitle(game.title)));

      if (rawgResults.results.length > 0) {
        for (const rawgGame of rawgResults.results) {
          if (existingSlugs.has(normalizeTitle(rawgGame.name))) {
            continue;
          }

          games.push({
            id: `rawg-${rawgGame.id}`,
            slug: rawgGame.slug,
            title: rawgGame.name,
            coverImage: rawgGame.background_image ?? "",
            headerImage: rawgGame.background_image ?? "",
            screenshots: (rawgGame.short_screenshots ?? []).map((s) => s.image),
            platforms: mapRawgPlatforms(rawgGame.platforms) as Platform[],
            genres: (rawgGame.genres ?? []).map((g) => g.name),
            tags: (rawgGame.tags ?? []).slice(0, 6).map((t) => t.name),
            developer: "",
            publisher: "",
            releaseDate: rawgGame.released ?? "",
            description: "",
            score: rawgGame.metacritic ?? Math.round((rawgGame.rating || 3) * 20),
            verdictLabel:
              rawgGame.metacritic && rawgGame.metacritic >= 80
                ? "MUST PLAY"
                : rawgGame.metacritic && rawgGame.metacritic >= 65
                  ? "WORTH IT"
                  : "MIXED",
            verdictSummary: "",
            pros: [],
            cons: [],
            monetization: "Paid",
            performanceNotes: "",
            monetizationNotes: "",
            reviewCount: rawgGame.ratings_count ?? 0,
            rawgRating: rawgGame.rating,
            rawgMetacritic: rawgGame.metacritic ?? undefined,
            subtitle: "",
          });
          existingSlugs.add(normalizeTitle(rawgGame.name));
        }

        total = games.length;
        totalIsExact = false;
      }
    } catch (error) {
      console.warn("[search-service] RAWG preview fallback failed:", error);
    }
  }

  return {
    items: games,
    total,
    page,
    pageSize: SEARCH_PAGE_SIZE,
    hasMore: start + SEARCH_PAGE_SIZE < total,
    totalIsExact,
  };
}

export async function loadSearchResults(state: SearchGamesState): Promise<PaginatedResponse<Game>> {
  const cacheKey = JSON.stringify(searchGamesStateToFilters(state));
  return unstable_cache(
    () => fetchSearchResults(state),
    ["search-results-v2", cacheKey],
    { revalidate: SEARCH_REVALIDATE_SECONDS }
  )();
}
