/**
 * GET /api/games/[slug]/steam-reviews
 *
 * Returns top Steam player reviews for a game.
 * Fetches from Supabase cache first; if stale or empty, refreshes from Steam API.
 */

import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api/response";

const STEAM_REVIEWS_API = "https://store.steampowered.com/appreviews";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") ?? "3", 10),
    10
  );

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonOk({ reviews: [], total: 0, steamAppId: null });
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    // Look up the game by slug to get steam_app_id
    const { data: game } = await supabase
      .from("games")
      .select("id, steam_app_id, title, cover_image, header_image")
      .eq("slug", slug)
      .single();

    if (!game?.steam_app_id) {
      return jsonOk({ reviews: [], total: 0, steamAppId: null, message: "No Steam App ID", gameTitle: game?.title ?? null, coverImage: null });
    }

    const gameTitle = game.title ?? null;
    const coverImage = game.header_image || game.cover_image || null;

    // Check cache freshness
    const { data: cached } = await supabase
      .from("steam_reviews")
      .select("*")
      .eq("game_id", game.id)
      .order("weighted_vote_score", { ascending: false })
      .limit(limit);

    const cacheAge = cached?.[0]?.fetched_at
      ? Date.now() - new Date(cached[0].fetched_at).getTime()
      : Infinity;

    // Get the actual total review count from the games table (not just cached rows)
    const { data: gameStats } = await supabase
      .from("games")
      .select("review_count")
      .eq("id", game.id)
      .single();
    const trueTotal = gameStats?.review_count ?? cached?.length ?? 0;

    // If cache is fresh enough, return it
    if (cached && cached.length >= limit && cacheAge < CACHE_TTL_MS) {
      return jsonOk({
        reviews: cached.map(mapSteamReview),
        total: trueTotal,
        steamAppId: game.steam_app_id,
        gameTitle,
        coverImage,
        source: "cache",
      });
    }

    // Fetch fresh from Steam API
    const steamUrl = `${STEAM_REVIEWS_API}/${game.steam_app_id}?json=1&language=english&filter=all&review_type=all&purchase_type=all&num_per_page=20&filter_offtopic_activity=1`;

    const res = await fetch(steamUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "VerdictGames/1.0" },
    });

    if (!res.ok) {
      // Return stale cache if Steam API fails
      if (cached && cached.length > 0) {
        return jsonOk({
          reviews: cached.map(mapSteamReview),
          total: cached.length,
          steamAppId: game.steam_app_id,
          gameTitle,
          coverImage,
          source: "stale-cache",
        });
      }
      return jsonOk({ reviews: [], total: 0, steamAppId: game.steam_app_id, gameTitle, coverImage });
    }

    const data = await res.json();
    const steamReviews = data?.reviews ?? [];

    if (steamReviews.length === 0) {
      return jsonOk({
        reviews: (cached ?? []).map(mapSteamReview),
        total: cached?.length ?? 0,
        steamAppId: game.steam_app_id,
        gameTitle,
        coverImage,
      });
    }

    // Upsert into Supabase
    const rows = steamReviews.map((r: SteamAPIReview) => ({
      game_id: game.id,
      steam_app_id: game.steam_app_id,
      recommendation_id: String(r.recommendationid),
      language: r.language ?? "english",
      voted_up: r.voted_up,
      review_text: (r.review ?? "").slice(0, 5000),
      playtime_at_review: r.author?.playtime_at_review ?? 0,
      playtime_forever: r.author?.playtime_forever ?? 0,
      author_steam_id: r.author?.steamid ?? null,
      author_playtime_forever: r.author?.playtime_forever ?? 0,
      authored_at: r.timestamp_created ? new Date(r.timestamp_created * 1000).toISOString() : null,
      updated_at: r.timestamp_updated ? new Date(r.timestamp_updated * 1000).toISOString() : null,
      votes_up: r.votes_up ?? 0,
      votes_funny: r.votes_funny ?? 0,
      weighted_vote_score: parseFloat(r.weighted_vote_score ?? "0"),
      steam_purchase: r.steam_purchase ?? true,
      received_for_free: r.received_for_free ?? false,
      fetched_at: new Date().toISOString(),
    }));

    await supabase
      .from("steam_reviews")
      .upsert(rows, { onConflict: "game_id,recommendation_id" });

    // Return top reviews sorted by helpfulness
    const sorted = rows
      .sort((a: { weighted_vote_score: number }, b: { weighted_vote_score: number }) => b.weighted_vote_score - a.weighted_vote_score)
      .slice(0, limit);

    return jsonOk({
      reviews: sorted.map(mapSteamReviewRow),
      total: steamReviews.length,
      steamAppId: game.steam_app_id,
      gameTitle,
      coverImage,
      source: "fresh",
    });
  } catch (err) {
    console.error("[API] /games/[slug]/steam-reviews error:", err);
    return jsonOk({ reviews: [], total: 0, steamAppId: null });
  }
}

// ── Types & Mappers ──

interface SteamAPIReview {
  recommendationid: string;
  language?: string;
  review?: string;
  voted_up: boolean;
  votes_up?: number;
  votes_funny?: number;
  weighted_vote_score?: string;
  steam_purchase?: boolean;
  received_for_free?: boolean;
  timestamp_created?: number;
  timestamp_updated?: number;
  author?: {
    steamid?: string;
    playtime_at_review?: number;
    playtime_forever?: number;
  };
}

function mapSteamReview(row: Record<string, unknown>) {
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

function mapSteamReviewRow(row: Record<string, unknown>) {
  return {
    id: row.game_id,
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
