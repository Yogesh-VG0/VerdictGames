/**
 * GET /api/games/new-releases
 *
 * Returns games released within the last 2 years, sorted by release date.
 * Delegates to the shared service layer.
 */

export const revalidate = 120; // ISR: revalidate every 2 minutes

import { NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { jsonOk } from "@/lib/api/response";
import { fetchNewReleases } from "@/lib/services/homepage";

export async function GET(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return jsonOk([], 200, { cache: true });
    }

    const limit = parseInt(
      request.nextUrl.searchParams.get("limit") ?? "8",
      10
    );

    const games = await fetchNewReleases(limit);
    return jsonOk(games, 200, { cache: true });
  } catch (err) {
    unstable_rethrow(err);
    console.error("[API] /games/new-releases error:", err);
    return jsonOk([], 200, { cache: true });
  }
}
