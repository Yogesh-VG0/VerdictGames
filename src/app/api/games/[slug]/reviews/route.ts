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
import { jsonOk, jsonNotFound } from "@/lib/api/response";
import { mapReviewRow } from "@/lib/db/mappers";
import type { PaginatedResponse, Review } from "@/lib/types";

const PAGE_SIZE = 12;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const searchParams = request.nextUrl.searchParams;
  const sort = searchParams.get("sort") ?? "newest";
  const page = parseInt(searchParams.get("page") ?? "1", 10);

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const empty: PaginatedResponse<Review> = { items: [], total: 0, page, pageSize: PAGE_SIZE, hasMore: false };
      return jsonOk(empty);
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    // Get current user for their vote state (optional)
    let currentProfileId: string | null = null;
    try {
      const { getCurrentUser } = await import("@/lib/supabase/auth");
      const user = await getCurrentUser();
      currentProfileId = user?.profileId ?? null;
    } catch {
      // Not authenticated — that's fine
    }

    // First, get the game ID from slug
    const { data: gameData } = await supabase
      .from("games")
      .select("id")
      .eq("slug", slug)
      .maybeSingle() as { data: { id: string } | null };

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

    // Fetch vote aggregates for these reviews
    const reviewIds = (data ?? []).map((r: Record<string, unknown>) => r.id as string);
    
    let voteCounts: Record<string, { up: number; down: number }> = {};
    let userVotes: Record<string, number> = {};

    if (reviewIds.length > 0) {
      // Get aggregate vote counts per review
      const { data: voteData } = await supabase
        .from("review_votes")
        .select("review_id, value")
        .in("review_id", reviewIds);

      if (voteData) {
        for (const v of voteData) {
          if (!voteCounts[v.review_id]) voteCounts[v.review_id] = { up: 0, down: 0 };
          if (v.value === 1) voteCounts[v.review_id].up++;
          else if (v.value === -1) voteCounts[v.review_id].down++;
        }
      }

      // Get current user's votes
      if (currentProfileId) {
        const { data: myVotes } = await supabase
          .from("review_votes")
          .select("review_id, value")
          .in("review_id", reviewIds)
          .eq("profile_id", currentProfileId);

        if (myVotes) {
          for (const v of myVotes) {
            userVotes[v.review_id] = v.value;
          }
        }
      }
    }

    const reviews = (data ?? []).map((row: Record<string, unknown>) => {
      const reviewId = row.id as string;
      const enriched = {
        ...row,
        vote_up_count: voteCounts[reviewId]?.up ?? 0,
        vote_down_count: voteCounts[reviewId]?.down ?? 0,
        user_vote_value: userVotes[reviewId] ?? null,
      };
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
    const empty: PaginatedResponse<Review> = { items: [], total: 0, page, pageSize: PAGE_SIZE, hasMore: false };
    return jsonOk(empty);
  }
}
