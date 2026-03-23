/**
 * GET /api/search
 *
 * Full-text search across games with filter support.
 * Query params: q, platform, genre, year, monetization, sort, page
 *
 * On-demand ingest: if a text query returns 0 results and no filters
 * are active, attempts to ingest the game from external sources.
 */

import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api/response";
import { mapGameRow } from "@/lib/db/mappers";
import { confidenceWeightedScore } from "@/lib/utils/quality";
import type { Game, PaginatedResponse, SortOption, Platform } from "@/lib/types";
import type { GameRow } from "@/lib/supabase/types";

const PAGE_SIZE = 24;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawQ = params.get("q") ?? "";
  // Sanitize: strip characters that could break PostgREST .or() syntax
  const q = rawQ.replace(/[%_(),.;'"\\]/g, "").trim();
  const platform = params.get("platform") ?? "All";
  const genre = params.get("genre") ?? "";
  const year = params.get("year") ?? "";
  const monetization = params.get("monetization") ?? "All";
  const sort = (params.get("sort") ?? "relevance") as SortOption;
  const page = parseInt(params.get("page") ?? "1", 10);

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const empty: PaginatedResponse<Game> = { items: [], total: 0, page, pageSize: PAGE_SIZE, hasMore: false };
      return jsonOk(empty);
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    let query = supabase.from("games").select("*", { count: "exact" });

    // Text search — use ilike on title, or Postgres full-text if scaled
    if (q) {
      query = query.or(
        `title.ilike.%${q}%,developer.ilike.%${q}%,publisher.ilike.%${q}%,description.ilike.%${q}%`
      );
    }

    // Platform filter — supports family grouping (e.g. PlayStation = PS4 + PS5)
    if (platform && platform !== "All") {
      const PLATFORM_FAMILIES: Record<string, string[]> = {
        "PlayStation 5": ["PlayStation 5", "PlayStation 4"],
        "Xbox Series X|S": ["Xbox Series X|S", "Xbox One"],
        "Nintendo Switch": ["Nintendo Switch", "Nintendo Switch 2"],
      };
      const family = PLATFORM_FAMILIES[platform];
      if (family) {
        query = query.or(family.map(p => `platforms.cs.{${p}}`).join(","));
      } else {
        query = query.contains("platforms", [platform]);
      }
    }

    // Genre filter
    if (genre) {
      query = query.contains("genres", [genre]);
    }

    // Year filter
    if (year) {
      query = query
        .gte("release_date", `${year}-01-01`)
        .lte("release_date", `${year}-12-31`);
    }

    // Monetization filter
    if (monetization && monetization !== "All") {
      query = query.eq("monetization", monetization);
    }

    // Sorting (tie-break on `id` for stable pagination across pages)
    const today = new Date().toISOString().slice(0, 10);
    switch (sort) {
      case "newest":
        // Only released games, newest first
        query = query.lte("release_date", today)
          .order("release_date", { ascending: false }).order("id", { ascending: true });
        break;
      case "upcoming":
        // Only unreleased games, soonest first
        query = query.gt("release_date", today)
          .order("release_date", { ascending: true }).order("id", { ascending: true });
        break;
      case "recently-added":
        // Newest DB entries
        query = query.order("created_at", { ascending: false }).order("id", { ascending: true });
        break;
      case "top-rated":
        query = query.order("score", { ascending: false }).order("id", { ascending: true });
        break;
      case "trending":
        query = query
          .order("momentum", { ascending: false, nullsFirst: false })
          .order("current_players", { ascending: false, nullsFirst: false })
          .order("score", { ascending: false })
          .order("id", { ascending: true });
        break;
      default:
        // relevance — if there's a query, rank by release_date (most relevant recent first)
        // if no query, use score-weighted ordering (different from "newest" which is purely date-based)
        if (q) {
          query = query.order("release_date", { ascending: false }).order("id", { ascending: true });
        } else {
          query = query
            .order("score", { ascending: false })
            .order("release_date", { ascending: false })
            .order("id", { ascending: true });
        }
        break;
    }

    // For top-rated, over-fetch so we can re-sort by confidence-weighted score in JS
    const isTopRated = sort === "top-rated";
    const fetchSize = isTopRated ? PAGE_SIZE * 4 : PAGE_SIZE;
    const start = (page - 1) * (isTopRated ? PAGE_SIZE * 4 : PAGE_SIZE);
    query = query.range(isTopRated ? 0 : start, isTopRated ? fetchSize - 1 : start + PAGE_SIZE - 1);

    const { data, error, count } = await query as unknown as { data: GameRow[] | null; error: unknown; count: number | null };

    if (error) throw error;

    let rows = data ?? [];

    // Re-sort top-rated by confidence-weighted score so tiny-sample 100% games don't dominate
    if (isTopRated && rows.length > 0) {
      rows.sort((a, b) => confidenceWeightedScore(b) - confidenceWeightedScore(a));
      const trStart = (page - 1) * PAGE_SIZE;
      rows = rows.slice(trStart, trStart + PAGE_SIZE);
    }

    let games = rows.map(mapGameRow);
    let total = count ?? 0;

    // ── 3-layer search: DB → RAWG instant preview → background ingest ──
    const noFilters = platform === "All" && !genre && !year && monetization === "All";
    if (total < 3 && q.length >= 2 && page === 1 && noFilters) {
      try {
        // Layer 2: RAWG instant search for immediate results
        const { searchRawg, mapRawgPlatforms } = await import("@/lib/external/rawg");
        const rawgResults = await searchRawg(q, 1, 5);
        const { normalizeTitle } = await import("@/lib/utils/slugify");
        const existingSlugs = new Set(games.map((g) => normalizeTitle(g.title)));

        if (rawgResults.results.length > 0) {
          // Show RAWG results instantly as preview cards
          for (const rg of rawgResults.results) {
            if (existingSlugs.has(normalizeTitle(rg.name))) continue;
            const previewGame: Game = {
              id: `rawg-${rg.id}`,
              slug: rg.slug,
              title: rg.name,
              coverImage: rg.background_image ?? "",
              headerImage: rg.background_image ?? "",
              screenshots: (rg.short_screenshots ?? []).map((s) => s.image),
              platforms: mapRawgPlatforms(rg.platforms) as Platform[],
              genres: (rg.genres ?? []).map((g) => g.name),
              tags: (rg.tags ?? []).slice(0, 6).map((t) => t.name),
              developer: "",
              publisher: "",
              releaseDate: rg.released ?? "",
              description: "",
              score: rg.metacritic ?? Math.round((rg.rating || 3) * 20),
              verdictLabel: rg.metacritic && rg.metacritic >= 80 ? "MUST PLAY" : rg.metacritic && rg.metacritic >= 65 ? "WORTH IT" : rg.metacritic && rg.metacritic >= 45 ? "MIXED" : "MIXED",
              verdictSummary: "",
              pros: [],
              cons: [],
              monetization: "Paid",
              performanceNotes: "",
              monetizationNotes: "",
              reviewCount: rg.ratings_count ?? 0,
              rawgRating: rg.rating,
              rawgMetacritic: rg.metacritic ?? undefined,
              subtitle: "",
            };
            games.push(previewGame);
            existingSlugs.add(normalizeTitle(rg.name));
          }
          total = games.length;
        }

        // Layer 3 REMOVED: no auto-ingest from search typing.
        // Ingest only happens on explicit game page visit or admin action.
      } catch (ingestErr) {
        console.warn("[API] /search on-demand ingest failed:", ingestErr);
      }
    }

    const paginatedResult: PaginatedResponse<Game> = {
      items: games,
      total,
      page,
      pageSize: PAGE_SIZE,
      hasMore: start + PAGE_SIZE < total,
    };

    return jsonOk(paginatedResult);
  } catch (err) {
    console.error("[API] /search error:", err);
    const empty: PaginatedResponse<Game> = { items: [], total: 0, page, pageSize: PAGE_SIZE, hasMore: false };
    return jsonOk(empty);
  }
}
