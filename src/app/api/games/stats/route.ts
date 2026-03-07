/**
 * GET /api/games/stats
 *
 * Returns site-wide statistics: total games, reviews, users, and data sources.
 */

import { jsonOk, jsonError } from "@/lib/api/response";

export async function GET() {
  try {
    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    const [gamesRes, reviewsRes, usersRes] = await Promise.all([
      supabase.from("games").select("id", { count: "exact", head: true }),
      supabase.from("reviews").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);

    return jsonOk({
      totalGames: gamesRes.count ?? 0,
      totalReviews: reviewsRes.count ?? 0,
      totalUsers: usersRes.count ?? 0,
      enrichmentSources: 5, // RAWG, Steam, IGDB, CheapShark, Wikipedia
    });
  } catch {
    return jsonError("Failed to fetch stats", 500);
  }
}
