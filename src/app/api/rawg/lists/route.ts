/**
 * GET /api/rawg/lists
 *
 * Proxy for RAWG curated list endpoints.
 * Query params:
 *   type: "best-of-year" | "popular-in-year" | "all-time" | "recent" | "genre"
 *   year: number (for popular-in-year)
 *   genre: string (for genre browsing)
 *   page: number (default 1)
 *   pageSize: number (default 20)
 * 
 * NOTE: RAWG API already handles content filtering, so we don't filter here.
 */

export const revalidate = 3600; // ISR: revalidate every hour (RAWG data is relatively static)

import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import type { RawgListItem, RawgListResponse } from "@/lib/external/rawg";

// Our desired page size for the frontend (5 columns × 4 rows = 20)
const FRONTEND_PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const type = sp.get("type") ?? "best-of-year";
  const page = parseInt(sp.get("page") ?? "1", 10);
  const pageSize = Math.min(parseInt(sp.get("pageSize") ?? String(FRONTEND_PAGE_SIZE), 10), 40);

  try {
    const {
      getRawgBestOfYear,
      getRawgPopularInYear,
      getRawgAllTimeTop,
      getRawgRecentReleases,
      getRawgByGenre,
    } = await import("@/lib/external/rawg");

    const year = parseInt(sp.get("year") ?? String(new Date().getFullYear() - 1), 10);
    const genre = sp.get("genre") ?? "action";
    
    // Fetch directly from RAWG with our desired page size
    let resp: RawgListResponse;
    switch (type) {
      case "best-of-year":
        resp = await getRawgBestOfYear(page, pageSize);
        break;
      case "popular-in-year":
        resp = await getRawgPopularInYear(year, page, pageSize);
        break;
      case "all-time":
        resp = await getRawgAllTimeTop(page, pageSize);
        break;
      case "recent":
        resp = await getRawgRecentReleases(page, pageSize);
        break;
      case "genre":
        resp = await getRawgByGenre(genre, page, pageSize);
        break;
      default:
        throw new Error(`Unknown list type: ${type}`);
    }
    
    const totalCount = resp.count;
    const results = resp.results;

    // Map to a lighter response format
    const items = results.map((item: RawgListItem) => ({
      rawgId: item.id,
      slug: item.slug,
      name: item.name,
      released: item.released,
      tba: item.tba,
      image: item.background_image,
      rating: item.rating,
      ratingsCount: item.ratings_count,
      metacritic: item.metacritic,
      added: item.added,
      toplay: item.added_by_status?.toplay ?? 0,
      playing: item.added_by_status?.playing ?? 0,
      owned: item.added_by_status?.owned ?? 0,
      platforms: (item.platforms ?? []).map((p) => p.platform.name),
      genres: (item.genres ?? []).map((g) => g.name),
      screenshots: (item.short_screenshots ?? []).slice(0, 3).map((s) => s.image),
      clip: item.clip?.video ? `https://www.youtube.com/watch?v=${item.clip.video}` : null,
    }));

    // ── Resolve DB slugs: RAWG slugs often differ from our DB slugs ──
    // e.g. RAWG "god-of-war-2" = "God of War (2018)" but our DB has "god-of-war-2018"
    // Cross-reference all rawg_ids with our DB in a single query and swap slugs.
    try {
      const rawgIds = items.map((i) => i.rawgId).filter(Boolean);
      if (rawgIds.length > 0) {
        const { getPublicSupabase } = await import("@/lib/supabase/public");
        const supabase = getPublicSupabase();
        const { data: dbGames } = await supabase
          .from("games")
          .select("rawg_id, slug")
          .in("rawg_id", rawgIds);

        if (dbGames && dbGames.length > 0) {
          const slugMap = new Map<number, string>();
          for (const g of dbGames) {
            if (g.rawg_id) slugMap.set(g.rawg_id, g.slug);
          }
          for (const item of items) {
            const dbSlug = slugMap.get(item.rawgId);
            if (dbSlug) item.slug = dbSlug;
          }
        }
      }
    } catch (slugErr) {
      // Non-fatal — fall back to RAWG slugs if DB lookup fails
      console.warn("[RAWG lists] DB slug resolution failed:", slugErr);
    }

    // Determine if there are more pages
    const hasNext = page * pageSize < totalCount;
    
    return jsonOk({
      count: totalCount,
      page,
      pageSize,
      hasNext,
      items,
    });
  } catch (err) {
    return jsonError((err as Error).message, 500);
  }
}
