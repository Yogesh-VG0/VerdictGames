/**
 * GET /api/library/stats — Get library statistics for current user
 */

import { jsonOk, jsonError } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import type { LibraryStats } from "@/lib/types";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Not authenticated", 401);

  try {
    const supabase = getServerSupabase();

    // Get all user games with joined game data for genre breakdown
    const { data: userGames } = await supabase
      .from("user_games")
      .select("status, personal_rating, hours_played, game:games!inner(genres)")
      .eq("user_id", user.profileId) as { data: { status: string; personal_rating: number | null; hours_played: number; game: { genres: string[] } | null }[] | null };

    const items = userGames ?? [];

    const stats: LibraryStats = {
      total: items.length,
      wishlist: items.filter((g) => g.status === "wishlist").length,
      playing: items.filter((g) => g.status === "playing").length,
      completed: items.filter((g) => g.status === "completed").length,
      dropped: items.filter((g) => g.status === "dropped").length,
      paused: items.filter((g) => g.status === "paused").length,
      totalHours: items.reduce((sum, g) => sum + (Number(g.hours_played) || 0), 0),
      averageRating: 0,
      genreBreakdown: {},
    };

    // Average rating (only rated games)
    const rated = items.filter((g) => g.personal_rating != null);
    if (rated.length > 0) {
      stats.averageRating = Math.round(
        rated.reduce((sum, g) => sum + (g.personal_rating ?? 0), 0) / rated.length
      );
    }

    // Genre breakdown
    for (const item of items) {
      const game = item.game as { genres: string[] } | null;
      if (game?.genres) {
        for (const genre of game.genres) {
          stats.genreBreakdown[genre] = (stats.genreBreakdown[genre] ?? 0) + 1;
        }
      }
    }

    return jsonOk(stats);
  } catch (err) {
    console.error("[API] /library/stats error:", err);
    return jsonError("Failed to fetch stats");
  }
}
