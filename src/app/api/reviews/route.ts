/**
 * GET /api/reviews — Global reviews feed
 * POST /api/reviews — Submit a new review (authenticated)
 *
 * Query params (GET): sort (newest|helpful), platform, page
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError, jsonBadRequest } from "@/lib/api/response";
import { mapReviewRow } from "@/lib/db/mappers";
import type { PaginatedResponse, Review } from "@/lib/types";

const PAGE_SIZE = 12;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sort = searchParams.get("sort") ?? "newest";
  const platform = searchParams.get("platform") ?? "All";
  const page = parseInt(searchParams.get("page") ?? "1", 10);

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const empty: PaginatedResponse<Review> = { items: [], total: 0, page, pageSize: PAGE_SIZE, hasMore: false };
      return jsonOk(empty);
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    let query = supabase
      .from("reviews")
      .select(
        `
        *,
        game:games!inner(slug, title, cover_image),
        profile:profiles!inner(username, avatar_url)
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

    const reviews = (data ?? []).map((row: Record<string, unknown>) =>
      mapReviewRow(row as Parameters<typeof mapReviewRow>[0])
    );

    const result: PaginatedResponse<Review> = {
      items: reviews,
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
      hasMore: start + PAGE_SIZE < (count ?? 0),
    };

    return jsonOk(result);
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

    if (!gameId) return jsonBadRequest("gameId is required");
    if (rating === undefined || rating < 0 || rating > 100) return jsonBadRequest("rating must be 0–100");
    if (!title || title.length < 3) return jsonBadRequest("title must be at least 3 characters");

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

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
        title,
        body: bodyText ?? "",
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
