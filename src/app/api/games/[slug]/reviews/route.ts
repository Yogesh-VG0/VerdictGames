/**
 * GET /api/games/[slug]/reviews
 *
 * Returns paginated reviews for a specific game.
 * Query params: sort (newest|helpful), page
 * 
 * Now includes vote_up_count, vote_down_count per review,
 * and user_vote_value for the current authenticated user.
 */

import { NextRequest } from "next/server";
import { jsonError, jsonPrivateOk as jsonOk, jsonNotFound } from "@/lib/api/response";
import { boundedHomepageRead } from "@/lib/services/homepage-budget";
import { getPublicSupabase } from "@/lib/supabase/public";
import { mapReviewRow } from "@/lib/db/mappers";
import { getAuthSupabase, getCurrentUser } from "@/lib/supabase/auth";
import { attachReviewVoteFields, getReviewVoteAggregates, getUserReviewVotes } from "@/lib/reviewVotes";
import type { PaginatedResponse, Review } from "@/lib/types";

const PAGE_SIZE = 12;
export const maxDuration = 15;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    return await boundedHomepageRead(5500, () => readReviews(request, params));
  } catch {
    return jsonError("Community reviews temporarily unavailable", 503);
  }
}

async function readReviews(request: NextRequest, params: Promise<{ slug: string }>) {
  const { slug } = await params;
  const searchParams = request.nextUrl.searchParams;
  const sort = searchParams.get("sort") ?? "newest";
  const page = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1));
  const includeUserVotes = searchParams.get("public") !== "1";

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const empty: PaginatedResponse<Review> = { items: [], total: 0, page, pageSize: PAGE_SIZE, hasMore: false };
      return jsonOk(empty);
    }

    const supabase = includeUserVotes ? await getAuthSupabase() : getPublicSupabase();

    const gameLookup = supabase
      .from("games")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    const [{ data: gameData, error: gameError }, user] = await Promise.all([
      gameLookup,
      includeUserVotes ? getCurrentUser({ strict: true }, supabase) : null,
    ]);

    if (gameError) throw gameError;

    if (!gameData) {
      return jsonNotFound("Game");
    }

    const gameId = gameData.id;

    // Build query
    let query = supabase
      .from("reviews")
      .select(
        `
        *,
        game:games!inner(slug, title, cover_image),
        profile:profiles!inner(username, display_name, avatar_url)
        `,
        { count: "exact" }
      )
      .eq("game_id", gameId);

    // Sort
    if (sort === "helpful") {
      query = query.order("helpful", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    // Pagination
    const start = (page - 1) * PAGE_SIZE;
    query = query.range(start, start + PAGE_SIZE - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const reviewIds = (data ?? []).map((r: Record<string, unknown>) => r.id as string);
    const [voteCounts, userVotes] = await Promise.all([
      getReviewVoteAggregates(supabase, reviewIds),
      getUserReviewVotes(supabase, reviewIds, user?.profileId ?? null),
    ]);

    const reviews = (data ?? []).map((row: Record<string, unknown>) => {
      const enriched = attachReviewVoteFields(
        row as unknown as Parameters<typeof attachReviewVoteFields>[0],
        userVotes,
        voteCounts
      );

      return mapReviewRow(enriched as Parameters<typeof mapReviewRow>[0]);
    });

    const result: PaginatedResponse<Review> = {
      items: reviews,
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
      hasMore: start + PAGE_SIZE < (count ?? 0),
    };

    return jsonOk(result);
  } catch (err) {
    console.error(`[API] /games/${slug}/reviews error:`, err);
    return jsonError("Community reviews temporarily unavailable", 503);
  }
}
