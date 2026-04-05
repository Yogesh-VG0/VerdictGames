import type { SupabaseClient } from "@supabase/supabase-js";
import type { SteamPlayerReview, SteamReviewsData } from "@/lib/api";
import { getPublicSupabase, hasPublicSupabaseEnv } from "@/lib/supabase/public";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type GameSteamContext = {
  id: string;
  steam_app_id: number | null;
  title: string | null;
  cover_image: string | null;
  header_image: string | null;
  steam_total_count: number | null;
};

type CachedSteamReviewRow = {
  id: string;
  recommendation_id: string;
  voted_up: boolean;
  review_text: string;
  playtime_at_review: number;
  playtime_forever: number;
  author_steam_id: string | null;
  authored_at: string | null;
  votes_up: number;
  votes_funny: number;
  weighted_vote_score: number;
  steam_purchase: boolean;
  fetched_at: string | null;
};

type LoadedSteamPlayerReview = SteamPlayerReview & {
  language: string;
  authorPlaytimeForever: number;
  updatedAt: string | null;
  receivedForFree: boolean;
};

type SteamAppReviewAuthor = {
  steamid?: string;
  playtime_forever?: number;
  playtime_at_review?: number;
};

type SteamAppReview = {
  recommendationid?: string;
  language?: string;
  review?: string;
  voted_up?: boolean;
  votes_up?: number;
  votes_funny?: number;
  weighted_vote_score?: number | string;
  steam_purchase?: boolean;
  received_for_free?: boolean;
  timestamp_created?: number;
  timestamp_updated?: number;
  author?: SteamAppReviewAuthor;
};

type SteamAppReviewsResponse = {
  success: number;
  query_summary?: {
    total_reviews?: number;
    num_reviews?: number;
  };
  reviews?: SteamAppReview[];
};

type FreshSteamReviewsResult = {
  fetchedAt: string;
  total: number;
  reviews: LoadedSteamPlayerReview[];
};

type SteamReviewsCacheMetadata = NonNullable<SteamReviewsData["cache"]>;

type PersistableSteamReviewInsert = Database["public"]["Tables"]["steam_reviews"]["Insert"];

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const STEAM_REVIEWS_FETCH_LIMIT = 21;

function hasServerSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function buildCacheMetadata(fetchedAt: string | null): SteamReviewsCacheMetadata {
  if (!fetchedAt) {
    return {
      fetchedAt: null,
      ageMs: null,
      ttlMs: CACHE_TTL_MS,
      isStale: true,
    };
  }

  const ageMs = Date.now() - new Date(fetchedAt).getTime();

  return {
    fetchedAt,
    ageMs,
    ttlMs: CACHE_TTL_MS,
    isStale: ageMs >= CACHE_TTL_MS,
  };
}

function toIsoTimestamp(timestamp?: number) {
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(Number(timestamp) * 1000).toISOString();
}

function toNonNegativeInteger(value: unknown) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.trunc(numeric));
}

function toScore(value: unknown) {
  const numeric = typeof value === "string"
    ? Number.parseFloat(value)
    : Number(value ?? 0);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return numeric;
}

function buildCoverImage(game: GameSteamContext | null) {
  return game?.header_image || game?.cover_image || null;
}

function mapSteamReview(row: CachedSteamReviewRow): SteamPlayerReview {
  return {
    id: row.id,
    recommendationId: row.recommendation_id,
    votedUp: row.voted_up,
    reviewText: row.review_text,
    playtimeAtReview: row.playtime_at_review,
    playtimeForever: row.playtime_forever,
    authorSteamId: row.author_steam_id,
    authoredAt: row.authored_at,
    votesUp: row.votes_up,
    votesFunny: row.votes_funny,
    weightedVoteScore: row.weighted_vote_score,
    steamPurchase: row.steam_purchase,
  };
}

function buildSteamReviewsData({
  game,
  reviews,
  total,
  source,
  cache,
  message,
}: {
  game: GameSteamContext | null;
  reviews: SteamPlayerReview[];
  total: number;
  source: string;
  cache: SteamReviewsCacheMetadata;
  message?: string;
}): SteamReviewsData {
  return {
    reviews,
    total,
    steamAppId: game?.steam_app_id ?? null,
    gameTitle: game?.title ?? null,
    coverImage: buildCoverImage(game),
    source,
    message,
    cache,
  };
}

async function getGameContext(
  slug: string,
  supabase: SupabaseClient<Database>
): Promise<GameSteamContext | null> {
  const { data } = await supabase
    .from("games")
    .select("id, steam_app_id, title, cover_image, header_image, steam_total_count")
    .eq("slug", slug)
    .maybeSingle() as { data: GameSteamContext | null };

  return data ?? null;
}

async function getCachedSteamReviews(
  gameId: string,
  limit: number,
  supabase: SupabaseClient<Database>
): Promise<CachedSteamReviewRow[]> {
  const { data } = await supabase
    .from("steam_reviews")
    .select("id, recommendation_id, voted_up, review_text, playtime_at_review, playtime_forever, author_steam_id, authored_at, votes_up, votes_funny, weighted_vote_score, steam_purchase, fetched_at")
    .eq("game_id", gameId)
    .order("weighted_vote_score", { ascending: false })
    .order("votes_up", { ascending: false })
    .limit(limit) as { data: CachedSteamReviewRow[] | null };

  return data ?? [];
}

async function fetchFreshSteamReviews(steamAppId: number, limit: number): Promise<FreshSteamReviewsResult | null> {
  const fetchLimit = Math.max(limit, STEAM_REVIEWS_FETCH_LIMIT);
  const response = await fetch(
    `https://store.steampowered.com/appreviews/${steamAppId}?json=1&language=all&purchase_type=all&review_type=all&num_per_page=${fetchLimit}&cursor=*`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    }
  );

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as SteamAppReviewsResponse;
  if (payload.success !== 1 || !Array.isArray(payload.reviews)) {
    return null;
  }

  const reviews = payload.reviews
    .map((review) => {
      const recommendationId = typeof review.recommendationid === "string"
        ? review.recommendationid
        : null;
      const reviewText = typeof review.review === "string"
        ? review.review.trim()
        : "";

      if (!recommendationId || !reviewText) {
        return null;
      }

      return {
        id: recommendationId,
        recommendationId,
        votedUp: Boolean(review.voted_up),
        reviewText,
        playtimeAtReview: toNonNegativeInteger(review.author?.playtime_at_review),
        playtimeForever: toNonNegativeInteger(review.author?.playtime_forever),
        authorSteamId: typeof review.author?.steamid === "string" ? review.author.steamid : null,
        authoredAt: toIsoTimestamp(review.timestamp_created),
        votesUp: toNonNegativeInteger(review.votes_up),
        votesFunny: toNonNegativeInteger(review.votes_funny),
        weightedVoteScore: toScore(review.weighted_vote_score),
        steamPurchase: Boolean(review.steam_purchase),
        language: typeof review.language === "string" && review.language ? review.language : "all",
        authorPlaytimeForever: toNonNegativeInteger(review.author?.playtime_forever),
        updatedAt: toIsoTimestamp(review.timestamp_updated),
        receivedForFree: Boolean(review.received_for_free),
      } satisfies LoadedSteamPlayerReview;
    })
    .filter((review): review is LoadedSteamPlayerReview => review !== null);

  const total = payload.query_summary?.total_reviews
    ?? payload.query_summary?.num_reviews
    ?? reviews.length;

  return {
    fetchedAt: new Date().toISOString(),
    total,
    reviews,
  };
}

async function persistFreshSteamReviews(
  game: GameSteamContext,
  fresh: FreshSteamReviewsResult,
  supabase: SupabaseClient<Database>
) {
  const { error: deleteError } = await supabase
    .from("steam_reviews")
    .delete()
    .eq("game_id", game.id);

  if (deleteError) {
    throw deleteError;
  }

  const rows: PersistableSteamReviewInsert[] = fresh.reviews.map((review) => ({
    game_id: game.id,
    steam_app_id: game.steam_app_id ?? 0,
    recommendation_id: review.recommendationId,
    language: review.language,
    voted_up: review.votedUp,
    review_text: review.reviewText,
    playtime_at_review: review.playtimeAtReview,
    playtime_forever: review.playtimeForever,
    author_steam_id: review.authorSteamId,
    author_playtime_forever: review.authorPlaytimeForever,
    authored_at: review.authoredAt,
    updated_at: review.updatedAt,
    votes_up: review.votesUp,
    votes_funny: review.votesFunny,
    weighted_vote_score: review.weightedVoteScore,
    steam_purchase: review.steamPurchase,
    received_for_free: review.receivedForFree,
    fetched_at: fresh.fetchedAt,
  }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("steam_reviews")
      .insert(rows);

    if (insertError) {
      throw insertError;
    }
  }

  const { error: gameError } = await supabase
    .from("games")
    .update({ steam_total_count: fresh.total })
    .eq("id", game.id);

  if (gameError) {
    throw gameError;
  }
}

export async function loadSteamReviews(slug: string, limit = 3): Promise<SteamReviewsData> {
  const clampedLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.trunc(limit), 1), STEAM_REVIEWS_FETCH_LIMIT)
    : 3;

  if (!hasPublicSupabaseEnv()) {
    return buildSteamReviewsData({
      game: null,
      reviews: [],
      total: 0,
      source: "empty",
      cache: buildCacheMetadata(null),
    });
  }

  const publicSupabase = getPublicSupabase();
  const game = await getGameContext(slug, publicSupabase);

  if (!game?.steam_app_id) {
    return buildSteamReviewsData({
      game,
      reviews: [],
      total: 0,
      source: "empty",
      message: "No Steam App ID",
      cache: buildCacheMetadata(null),
    });
  }

  const cached = await getCachedSteamReviews(game.id, clampedLimit, publicSupabase);
  const fetchedAt = cached[0]?.fetched_at ?? null;
  const cache = buildCacheMetadata(fetchedAt);
  const cachedTotal = game.steam_total_count ?? cached.length;

  if (cached.length > 0 && !cache.isStale) {
    return buildSteamReviewsData({
      game,
      reviews: cached.map(mapSteamReview),
      total: cachedTotal,
      source: "cache",
      cache,
    });
  }

  try {
    const fresh = await fetchFreshSteamReviews(game.steam_app_id, clampedLimit);

    if (fresh) {
      if (hasServerSupabaseEnv()) {
        try {
          await persistFreshSteamReviews(game, fresh, getServerSupabase());
        } catch (error) {
          console.error("[Steam Reviews] Failed to persist refreshed Steam reviews:", error);
        }
      }

      return buildSteamReviewsData({
        game,
        reviews: fresh.reviews.slice(0, clampedLimit),
        total: fresh.total,
        source: cached.length > 0 ? "live-refresh" : "live",
        cache: buildCacheMetadata(fresh.fetchedAt),
      });
    }
  } catch (error) {
    console.error("[Steam Reviews] Failed to refresh Steam reviews:", error);
  }

  if (cached.length > 0) {
    return buildSteamReviewsData({
      game,
      reviews: cached.map(mapSteamReview),
      total: cachedTotal,
      source: "stale-cache",
      cache,
    });
  }

  return buildSteamReviewsData({
    game,
    reviews: [],
    total: cachedTotal,
    source: "empty",
    cache,
  });
}
