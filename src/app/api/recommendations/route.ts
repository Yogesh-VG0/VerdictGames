/**
 * GET /api/recommendations — Personalized game recommendations
 *
 * For authenticated users: based on library genres/statuses
 * For anonymous: content-based diverse picks
 */

import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api/response";
import { mapGameRow } from "@/lib/db/mappers";
import type { GameRow } from "@/lib/supabase/types";

export async function GET(request: NextRequest) {
  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "8", 10);

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonOk([]);
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    // Try to get user-specific recommendations
    let userGenres: string[] = [];
    let userGameIds: string[] = [];

    try {
      const { getCurrentUser } = await import("@/lib/supabase/auth");
      const user = await getCurrentUser();

      if (user) {
        // Get user's library to find preferred genres
        const { data: userGames } = await supabase
          .from("user_games")
          .select("game_id, game:games!inner(genres)")
          .eq("user_id", user.profileId) as { data: { game_id: string; game: { genres: string[] } | null }[] | null };

        if (userGames && userGames.length > 0) {
          userGameIds = userGames.map((ug) => ug.game_id);

          // Count genre frequency
          const genreCounts: Record<string, number> = {};
          for (const ug of userGames) {
            const game = ug.game as { genres: string[] } | null;
            if (game?.genres) {
              for (const g of game.genres) {
                genreCounts[g] = (genreCounts[g] ?? 0) + 1;
              }
            }
          }

          // Top 3 genres
          userGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([g]) => g);
        }
      }
    } catch {
      // Not authenticated — that's ok, fall through to generic recommendations
    }

    // Build recommendation query
    let query = supabase
      .from("games")
      .select("*")
      .order("score", { ascending: false })
      .limit(limit * 3); // Over-fetch for filtering

    // If user has preferred genres, filter by them
    if (userGenres.length > 0) {
      query = query.overlaps("genres", userGenres);
    }

    const { data, error } = await query as { data: GameRow[] | null; error: unknown };
    if (error) throw error;

    let candidates = (data ?? []).map(mapGameRow);

    // Exclude games already in user's library
    if (userGameIds.length > 0) {
      candidates = candidates.filter((g) => !userGameIds.includes(g.id));
    }

    // Ensure genre diversity
    const seen = new Set<string>();
    const picks = [];
    for (const game of candidates) {
      if (picks.length >= limit) break;
      const primary = game.genres[0] ?? "unknown";
      if (!seen.has(primary) || seen.size >= limit) {
        seen.add(primary);
        picks.push(game);
      }
    }

    // Fill remaining
    if (picks.length < limit) {
      const pickIds = new Set(picks.map((p) => p.id));
      for (const game of candidates) {
        if (picks.length >= limit) break;
        if (!pickIds.has(game.id)) picks.push(game);
      }
    }

    return jsonOk(picks);
  } catch (err) {
    console.error("[API] /recommendations error:", err);
    return jsonOk([]);
  }
}
