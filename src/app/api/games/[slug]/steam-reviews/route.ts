/**
 * GET /api/games/[slug]/steam-reviews
 *
 * Returns top Steam player reviews for a game from the local cache.
 */

import { NextRequest, NextResponse } from "next/server";
import { loadSteamReviews } from "@/lib/services/steam-reviews";

const STEAM_REVIEWS_API_CACHE_CONTROL = "s-maxage=300, stale-while-revalidate=3600";

function jsonSteamReviews(data: unknown) {
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
    const data = await loadSteamReviews(slug, limit);
    return jsonSteamReviews(data);
  } catch (err) {
    console.error("[API] /games/[slug]/steam-reviews error:", err);
    return jsonSteamReviews({
      reviews: [],
      total: 0,
      steamAppId: null,
      source: "empty",
      cache: {
        fetchedAt: null,
        ageMs: null,
        ttlMs: 24 * 60 * 60 * 1000,
        isStale: true,
      },
    });
  }
}


