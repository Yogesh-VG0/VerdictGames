/**
 * GET /api/games/trending
 *
 * Returns trending games using a hybrid approach.
 * Delegates to the shared service layer.
 */

export const revalidate = 120; // ISR: revalidate every 2 minutes

import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api/response";
import { fetchTrendingGames } from "@/lib/services/homepage";

export async function GET(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonOk([]);
    }

    const limit = parseInt(
      request.nextUrl.searchParams.get("limit") ?? "10",
      10
    );

    const games = await fetchTrendingGames(limit);
    return jsonOk(games, 200, { cache: true });
  } catch (err) {
    console.error("[API] /games/trending error:", err);
    return jsonOk([], 200, { cache: true });
  }
}
