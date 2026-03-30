/**
 * GET /api/games/[slug]/steam-reviews
 *
 * Returns top Steam player reviews for a game from the local cache.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPublicSupabase, hasPublicSupabaseEnv } from "@/lib/supabase/public";

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

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const STEAM_REVIEWS_API_CACHE_CONTROL = "s-maxage=300, stale-while-revalidate=3600";

function buildCacheMetadata(fetchedAt: string | null) {
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

function jsonSteamReviews(data: Record<string, unknown>) {
  return NextResponse.json(
    { success: true, data },
    { status: 200, headers: { "Cache-Control": STEAM_REVIEWS_API_CACHE_CONTROL } }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const requestedLimit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "3", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 21) : 3;

  try {
    if (!hasPublicSupabaseEnv()) {
      return jsonSteamReviews({
        reviews: [],
        total: 0,
        steamAppId: null,
        source: "empty",
        cache: buildCacheMetadata(null),
      });
    }

    const supabase = getPublicSupabase();

    const { data: game } = await supabase
      .from("games")
      .select("id, steam_app_id, title, cover_image, header_image, review_count")
      .eq("slug", slug)
      .maybeSingle() as {
        data: {
          id: string;
          steam_app_id: number | null;
          title: string | null;
          cover_image: string | null;
          header_image: string | null;
          review_count: number | null;
        } | null;
      };

    if (!game?.steam_app_id) {
      return jsonSteamReviews({
        reviews: [],
        total: 0,
        steamAppId: null,
        message: "No Steam App ID",
        gameTitle: game?.title ?? null,
        coverImage: null,
        source: "empty",
        cache: buildCacheMetadata(null),
      });
    }

    const gameTitle = game.title ?? null;
    const coverImage = game.header_image || game.cover_image || null;

    const { data: cached } = await supabase
      .from("steam_reviews")
      .select("id, recommendation_id, voted_up, review_text, playtime_at_review, playtime_forever, author_steam_id, authored_at, votes_up, votes_funny, weighted_vote_score, steam_purchase, fetched_at")
      .eq("game_id", game.id)
      .order("weighted_vote_score", { ascending: false })
      .limit(limit) as { data: CachedSteamReviewRow[] | null };

    const fetchedAt = cached?.[0]?.fetched_at ?? null;
    const cache = buildCacheMetadata(fetchedAt);
    const total = game.review_count ?? cached?.length ?? 0;

    if (cached && cached.length > 0) {
      return jsonSteamReviews({
        reviews: cached.map(mapSteamReview),
        total,
        steamAppId: game.steam_app_id,
        gameTitle,
        coverImage,
        source: cache.isStale ? "stale-cache" : "cache",
        cache,
      });
    }

    return jsonSteamReviews({
      reviews: [],
      total,
      steamAppId: game.steam_app_id,
      gameTitle,
      coverImage,
      source: "empty",
      cache,
    });
  } catch (err) {
    console.error("[API] /games/[slug]/steam-reviews error:", err);
    return jsonSteamReviews({
      reviews: [],
      total: 0,
      steamAppId: null,
      source: "empty",
      cache: buildCacheMetadata(null),
    });
  }
}

function mapSteamReview(row: CachedSteamReviewRow) {
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

