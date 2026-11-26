/**
 * GET /api/recommendations — Personalized game recommendations
 *
 * For authenticated users: based on library genres/statuses
 * For anonymous: content-based diverse picks
 */

export const dynamic = "force-dynamic";
export const maxDuration = 15;

import { NextRequest } from "next/server";
import { boundedHomepageRead } from "@/lib/services/homepage-budget";
import { jsonError, jsonPrivateOk as jsonOk, jsonUnavailable } from "@/lib/api/response";
import { getHomepageRecommendationScore, isHomepageRecommendationEligible } from "@/lib/services/homepage";
import { mapGameRow } from "@/lib/db/mappers";
import { GAME_CARD_COLUMNS_WITH_DESC } from "@/lib/db/columns";
import { isQualityGame } from "@/lib/utils/quality";
import { dedupePublicCanonicalRows } from "@/lib/utils/publicCanonical";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { hasUsableCardImage } from "@/lib/utils/mediaReadiness";
import { hasUnreleasedStatus } from "@/lib/utils/release-status";
import { getDiscoveryCanonicalTitle, isPackagingEditionTitle } from "@/lib/utils/discovery";
import { diversifyRecommendations, recommendationVariantBase, removeRecommendationVariants } from "@/lib/utils/recommendation-selection";
import type { GameRow } from "@/lib/supabase/types";
import { getAuthSupabase, getCurrentUser } from "@/lib/supabase/auth";

export async function GET(request: NextRequest) {
  try {
    return await boundedHomepageRead(7500, () => loadRecommendations(request));
  } catch {
    return jsonUnavailable("Recommendations temporarily unavailable.");
  }
}

async function loadRecommendations(request: NextRequest) {
  const rawLimit = parseInt(request.nextUrl.searchParams.get("limit") ?? "8", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 8;
  const homepage = request.nextUrl.searchParams.get("context") === "homepage";
  const expectedAccount = homepage ? request.headers.get("x-verdict-account") : null;
  const exclusion = (request.nextUrl.searchParams.get("exclude") ?? "").slice(0, 6000);
  const shown = new Set(homepage ? exclusion.split(",").slice(0, 96).filter(slug => /^[a-z0-9_-]{1,100}$/i.test(slug)) : []);
  const respond = (games: ReturnType<typeof mapGameRow>[], personalized = false) =>
    jsonOk(homepage ? { games, personalized } : games);

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return jsonUnavailable("Recommendations temporarily unavailable.");
    }

    const supabase = await getAuthSupabase();

    // Try to get user-specific recommendations
    let userGenres: string[] = [];
    let genreAffinity = new Map<string, number>();
    let userGameIds: string[] = [];
    const ownedTitles = new Set<string>();
    const ownedVariants = new Set<string>();
    const ownedSteamIds = new Set<number>();
    let largeLibraryProfileId: string | undefined;

    try {
      const user = await getCurrentUser({ strict: true }, supabase);
      if (expectedAccount && user?.id !== expectedAccount) {
        return jsonError("Current account changed", 401);
      }

      if (user) {
        // Get user's library to find preferred genres
        const { data: userGames, error: libraryError } = await supabase
          .from("user_games")
          .select("game_id, game:games!inner(genres,title,steam_app_id)")
          .eq("user_id", user.profileId)
          .order("game_id").limit(1000) as { data: { game_id: string; game: Pick<GameRow, "genres" | "title" | "steam_app_id"> | null }[] | null; error: unknown };

        if (libraryError) throw libraryError;

        if (userGames && userGames.length > 0) {
          userGameIds = userGames.map((ug) => ug.game_id);
          if (userGames.length === 1000) largeLibraryProfileId = user.profileId;

          // Count genre frequency
          const genreCounts: Record<string, number> = {};
          for (const ug of userGames) {
            const game = ug.game;
            if (game?.steam_app_id) ownedSteamIds.add(game.steam_app_id);
            if (game?.title) {
              const base = recommendationVariantBase(game.title);
              if (base || isPackagingEditionTitle(game.title)) ownedVariants.add(base ?? getDiscoveryCanonicalTitle(game.title));
              ownedTitles.add(base ?? getDiscoveryCanonicalTitle(game.title));
            }
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
          genreAffinity = new Map(userGenres.map(genre => [genre, genreCounts[genre] / genreCounts[userGenres[0]]]));
        }
      }
    } catch (error) {
      console.error("[API] Could not resolve the recommendation account or library:", error);
      return jsonUnavailable("Recommendations temporarily unavailable.");
    }

    const today = new Date().toISOString().slice(0, 10);

    // Over-fetch so quality filtering + genre diversity still leaves enough
    const fetchLimit = Math.min(240, Math.max(100, limit * 8));

    // Build recommendation query — require minimum review count at DB level
    let query = supabase
      .from("games")
      .select(GAME_CARD_COLUMNS_WITH_DESC + ",franchise")
      .not("release_date", "is", null)
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
    if (!homepage && userGenres.length > 0) {
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
      if (hasUnreleasedStatus(r)) return false;
      return isQualityGame(r, "recommendations");
    });

    // Exclude games already in user's library
    if (userGameIds.length > 0) {
      const excludeSet = new Set(userGameIds);
      rows = rows.filter(row => {
        if (excludeSet.has(row.id) || row.steam_app_id && ownedSteamIds.has(row.steam_app_id)) return false;
        const variant = recommendationVariantBase(row.title);
        const canonical = variant ?? getDiscoveryCanonicalTitle(row.title);
        return !ownedVariants.has(canonical) && (!(variant || isPackagingEditionTitle(row.title)) || !ownedTitles.has(canonical));
      });
    }

    // The bounded genre sample may omit owned games from a large library.
    if (largeLibraryProfileId) {
      const ids = rows.map(row => row.id);
      const owned = new Set<string>();
      for (let offset = 0; offset < ids.length; offset += 80) {
        const page = await supabase.from("user_games").select("game_id")
          .eq("user_id", largeLibraryProfileId).in("game_id", ids.slice(offset, offset + 80));
        if (page.error) throw page.error;
        for (const row of page.data ?? []) owned.add(row.game_id);
      }
      rows = rows.filter(row => !owned.has(row.id));
    }
    rows = removeRecommendationVariants(dedupePublicCanonicalRows(rows));

    const matchesLibrary = (row: GameRow) => userGenres.some(genre => row.genres?.includes(genre));
    const libraryScore = (row: GameRow) => {
      const weights = [...new Set(row.genres ?? [])].map(genre => genreAffinity.get(genre) ?? 0).sort((a, b) => b - a);
      return (weights[0] ?? 0) * 22 + (weights[1] ?? 0) * 6;
    };
    const scores = new Map(rows.map(row => [
      row.id,
      getHomepageRecommendationScore(row) + (isHomepageRecommendationEligible(row) ? 10 : 0)
        + libraryScore(row),
    ]));
    rows.sort((a, b) => a.id.localeCompare(b.id));
    const select = (candidates: GameRow[], count: number) =>
      diversifyRecommendations(candidates, count, row => scores.get(row.id)!, row => Number(row.release_date?.slice(0, 4)));
    const picks = select(rows.filter(row => !shown.has(row.slug)), limit);
    if (picks.length < limit) picks.push(...select(rows.filter(row => shown.has(row.slug)), limit - picks.length));

    const relevant = picks.filter(matchesLibrary).length;
    return respond(picks.map(mapGameRow), relevant > 0 && relevant >= Math.ceil(picks.length / 3));
  } catch (err) {
    console.error("[API] /recommendations error:", err);
    return jsonUnavailable("Recommendations temporarily unavailable.");
  }
}
