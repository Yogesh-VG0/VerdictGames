/**
 * GET /api/reviews
 *
 * Returns the global reviews feed.
 * Query params: sort (newest|helpful), platform, page
 */

import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api/response";
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
