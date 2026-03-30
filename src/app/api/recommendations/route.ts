/**
 * GET /api/recommendations — Personalized game recommendations
 *
 * For authenticated users: based on library genres/statuses
 * For anonymous: content-based diverse picks
 */

export const revalidate = 120; // ISR: revalidate every 2 minutes

import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api/response";
import { mapGameRow } from "@/lib/db/mappers";
import { GAME_CARD_COLUMNS_WITH_DESC } from "@/lib/db/columns";
import { confidenceWeightedScore, isQualityGame } from "@/lib/utils/quality";
import { dedupePublicCanonicalRows } from "@/lib/utils/publicCanonical";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { hasUsableCardImage } from "@/lib/utils/mediaReadiness";
import type { GameRow } from "@/lib/supabase/types";

export async function GET(request: NextRequest) {
  const rawLimit = parseInt(request.nextUrl.searchParams.get("limit") ?? "8", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 8;

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return jsonOk([]);
    }

    const { getAuthSupabase } = await import("@/lib/supabase/auth");
    const supabase = await getAuthSupabase();

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

    // Recency gate: only recommend games from the last 3 years on homepage
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 36);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    // Over-fetch so quality filtering + genre diversity still leaves enough
    const fetchLimit = limit * 5;

    // Build recommendation query — require minimum review count at DB level
    let query = supabase
      .from("games")
      .select(GAME_CARD_COLUMNS_WITH_DESC)
      .not("release_date", "is", null)
      .gte("release_date", cutoffStr)
      .lte("release_date", today)           // exclude unreleased/future games
      .gte("score", 70)
      .gte("review_count", 50)              // minimum review threshold — no tiny-sample games
      .gte("confidence", 0.25)
      .not("cover_image", "is", null)       // must have a cover image
      .neq("cover_image", "")
      .order("verdict_score", { ascending: false, nullsFirst: false })
      .order("score", { ascending: false })
      .limit(fetchLimit);

    // If user has preferred genres, filter by them
    if (userGenres.length > 0) {
      query = query.overlaps("genres", userGenres);
    }

    const { data, error } = await query as { data: GameRow[] | null; error: unknown };
    if (error) throw error;

    // Quality filter: require image, decent description, non-provisional, public safe
    let rows = (data ?? []).filter((r) => {
      // Public safety + media readiness
      if (!isPublicSafeGame(r)) return false;
      if (!hasUsableCardImage(r)) return false;
      // Exclude provisional / coming soon
      if ((r as GameRow & { is_provisional?: boolean }).is_provisional) return false;
      if (r.verdict_label === "COMING SOON") return false;
      return isQualityGame(r, "recommendations");
    });

    // Exclude games already in user's library
    if (userGameIds.length > 0) {
      const excludeSet = new Set(userGameIds);
      rows = rows.filter((r) => !excludeSet.has(r.id));
    }

    rows = dedupePublicCanonicalRows(rows);

    // Sort by confidence-weighted score so low-review 100% games don't dominate
    rows.sort((a, b) => confidenceWeightedScore(b) - confidenceWeightedScore(a));

    // Ensure genre diversity: pick one per primary genre first
    const seen = new Set<string>();
    const picks: GameRow[] = [];
    for (const row of rows) {
      if (picks.length >= limit) break;
      const primary = (row.genres?.[0] ?? "unknown").toLowerCase();
      if (!seen.has(primary) || seen.size >= 8) {
        seen.add(primary);
        picks.push(row);
      }
    }

    // Fill remaining slots
    if (picks.length < limit) {
      const pickIds = new Set(picks.map((p) => p.id));
      for (const row of rows) {
        if (picks.length >= limit) break;
        if (!pickIds.has(row.id)) picks.push(row);
      }
    }

    return jsonOk(picks.map(mapGameRow), 200, { cache: true });
  } catch (err) {
    console.error("[API] /recommendations error:", err);
    return jsonOk([]);
  }
}
