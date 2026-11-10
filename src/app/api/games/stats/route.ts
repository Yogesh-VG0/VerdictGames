/**
 * GET /api/games/stats
 *
 * Returns site-wide statistics: total games, reviews, users, and data sources.
 */

export const dynamic = "force-dynamic";

import { jsonOk, jsonError } from "@/lib/api/response";

export async function GET() {
  try {
    const { getPublicSupabase } = await import("@/lib/supabase/public");
    const supabase = getPublicSupabase();

    const [gamesRes, reviewsRes, usersRes] = await Promise.all([
      supabase.from("games").select("id", { count: "exact", head: true }),
      supabase.from("reviews").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);

    if (gamesRes.error || reviewsRes.error || usersRes.error) throw new Error('Stats query failed');

    return jsonOk({
      totalGames: gamesRes.count ?? 0,
      totalReviews: reviewsRes.count ?? 0,
      totalUsers: usersRes.count ?? 0,
      enrichmentSources: 5, // RAWG, Steam, IGDB, CheapShark, Wikipedia
    }, 200, { cacheControl: 's-maxage=900, stale-while-revalidate=3600' });
  } catch {
    return jsonError("Failed to fetch stats", 500);
  }
}
