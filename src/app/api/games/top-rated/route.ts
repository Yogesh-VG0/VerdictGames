/**
 * GET /api/games/top-rated
 *
 * Returns games sorted by score descending.
 * Delegates to the shared service layer.
 */

export const revalidate = 120; // ISR: revalidate every 2 minutes

import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api/response";
import { fetchTopRated } from "@/lib/services/homepage";

export async function GET(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonOk([], 200, { cache: true });
    }

    const rawLimit = parseInt(
      request.nextUrl.searchParams.get("limit") ?? "16",
      10
    );
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 16;

    const games = await fetchTopRated(limit);
    return jsonOk(games, 200, { cache: true });
  } catch (err) {
    console.error("[API] /games/top-rated error:", err);
    return jsonOk([], 200, { cache: true });
  }
}
