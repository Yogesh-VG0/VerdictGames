/**
 * GET /api/reviews — Global reviews feed
 * POST /api/reviews — Submit a new review (authenticated)
 *
 * Query params (GET): sort (newest|helpful), platform, page
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError, jsonBadRequest } from "@/lib/api/response";
import { mapReviewRow } from "@/lib/db/mappers";
import { attachReviewVoteFields, getReviewVoteAggregates, getUserReviewVotes } from "@/lib/reviewVotes";
import type { PaginatedResponse, Review } from "@/lib/types";

const PAGE_SIZE = 12;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sort = searchParams.get("sort") ?? "newest";
  const platform = searchParams.get("platform") ?? "All";
  const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 100) : 1;

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const empty: PaginatedResponse<Review> = { items: [], total: 0, page, pageSize: PAGE_SIZE, hasMore: false };
      return jsonOk(empty);
    }

    const { getAuthSupabase, getCurrentUser } = await import("@/lib/supabase/auth");
    const supabase = await getAuthSupabase();

    const user = await getCurrentUser();
    const currentProfileId = user?.profileId ?? null;

    let query = supabase
      .from("reviews")
      .select(
        `
        *,
        game:games!inner(slug, title, cover_image),
        profile:profiles!inner(username, display_name, avatar_url)
        `,
        { count: "exact" }
      );

    // Platform filter
    if (platform && platform !== "All") {
      query = query.eq("platform", platform);
    }

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
    const voteCounts = await getReviewVoteAggregates(supabase, reviewIds);
    const userVotes = await getUserReviewVotes(supabase, reviewIds, currentProfileId);

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

    return jsonOk(result, 200, { cache: true });
  } catch (err) {
    console.error("[API] /reviews error:", err);
    const empty: PaginatedResponse<Review> = { items: [], total: 0, page, pageSize: PAGE_SIZE, hasMore: false };
    return jsonOk(empty);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { getCurrentUser } = await import("@/lib/supabase/auth");
    const user = await getCurrentUser();
    if (!user) return jsonError("Not authenticated", 401);

    const body = await request.json();
    const { gameId, rating, title, bodyText, pros, cons, platform } = body;
    const titleText = typeof title === "string" ? title.trim() : "";
    const reviewBody = typeof bodyText === "string" ? bodyText.trim() : "";

    if (!gameId) return jsonBadRequest("gameId is required");
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 0 || rating > 100) return jsonBadRequest("rating must be an integer 0–100");
    if (!titleText || titleText.length < 3) return jsonBadRequest("title must be at least 3 characters");
    if (titleText.length > 200) return jsonBadRequest("title must be 200 characters or less");
    if (reviewBody.length > 10000) return jsonBadRequest("review body must be 10,000 characters or less");
    if (Array.isArray(pros) && pros.length > 10) return jsonBadRequest("max 10 pros");
    if (Array.isArray(cons) && cons.length > 10) return jsonBadRequest("max 10 cons");

    const { getAuthSupabase } = await import("@/lib/supabase/auth");
    const supabase = await getAuthSupabase();

    // Check for existing review by this user on this game
    const { data: existing } = await supabase
      .from("reviews")
      .select("id")
      .eq("profile_id", user.profileId)
      .eq("game_id", gameId)
      .maybeSingle();

    if (existing) return jsonBadRequest("You already reviewed this game.");

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        game_id: gameId,
        profile_id: user.profileId,
        rating,
        title: titleText,
        body: reviewBody,
        pros: pros ?? [],
        cons: cons ?? [],
        platform: platform ?? "PC",
      })
      .select("id")
      .single();

    if (error) throw error;

    return jsonOk({ id: data.id });
  } catch (err) {
    console.error("[API] /reviews POST error:", err);
    return jsonError("Failed to submit review");
  }
}
