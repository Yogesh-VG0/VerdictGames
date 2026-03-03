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
import type { Game, PaginatedResponse, SortOption } from "@/lib/types";
import type { GameRow } from "@/lib/supabase/types";

const PAGE_SIZE = 12;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? "";
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

    // Platform filter
    if (platform && platform !== "All") {
      query = query.contains("platforms", [platform]);
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

    // Sorting
    switch (sort) {
      case "newest":
        query = query.order("release_date", { ascending: false });
        break;
      case "top-rated":
        query = query.order("score", { ascending: false });
        break;
      case "trending":
        query = query
          .order("trending", { ascending: false })
          .order("score", { ascending: false });
        break;
      default:
        // relevance — if there's a query, DB handles ranking; otherwise newest
        query = query.order("release_date", { ascending: false });
        break;
    }

    // Pagination
    const start = (page - 1) * PAGE_SIZE;
    query = query.range(start, start + PAGE_SIZE - 1);

    const { data, error, count } = await query as unknown as { data: GameRow[] | null; error: unknown; count: number | null };

    if (error) throw error;

    let games = (data ?? []).map(mapGameRow);
    let total = count ?? 0;

    // ── On-demand ingest: if text query + page 1 + no results + no filters ──
    const noFilters = platform === "All" && !genre && !year && monetization === "All";
    if (total === 0 && q.length >= 2 && page === 1 && noFilters) {
      try {
        const { ingestGame } = await import("@/lib/services/ingest");
        const result = await ingestGame({ query: q });
        if (result.success && result.gameId) {
          // Re-query to get the newly ingested game
          const { data: freshData, count: freshCount } = await supabase
            .from("games")
            .select("*", { count: "exact" })
            .eq("id", result.gameId) as unknown as { data: GameRow[] | null; count: number | null };
          if (freshData?.length) {
            games = freshData.map(mapGameRow);
            total = freshCount ?? 1;
          }
        }
      } catch (ingestErr) {
        console.warn("[API] /search on-demand ingest failed:", ingestErr);
        // Non-fatal: return empty results
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
