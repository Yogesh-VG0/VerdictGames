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
 * NOTE: RAWG API has page_size max of 40. We fetch multiple RAWG pages internally
 * to serve our desired pageSize (20) consistently.
 */

export const revalidate = 3600; // ISR: revalidate every hour (RAWG data is relatively static)

import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { isPublicSafeRawgGame } from "@/lib/utils/publicSafety";
import type { RawgListItem, RawgListResponse } from "@/lib/external/rawg";

// Our desired page size for the frontend (5 columns × 4 rows = 20)
const FRONTEND_PAGE_SIZE = 20;
// RAWG API page size (keep at 40 to minimize API calls)
const RAWG_PAGE_SIZE = 40;

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

    // Calculate which RAWG pages we need to fetch
    // For page 1 with pageSize 25, we need RAWG page 1 (items 1-40)
    // For page 2 with pageSize 25, we need RAWG page 1 (items 26-40) + page 2 (items 41-50)
    const startIndex = (page - 1) * pageSize; // 0-indexed start
    const endIndex = startIndex + pageSize;   // exclusive end
    
    // Which RAWG pages cover this range?
    const rawgPageStart = Math.floor(startIndex / RAWG_PAGE_SIZE) + 1;
    const rawgPageEnd = Math.floor((endIndex - 1) / RAWG_PAGE_SIZE) + 1;
    
    // Fetch required RAWG pages
    const year = parseInt(sp.get("year") ?? String(new Date().getFullYear() - 1), 10);
    const genre = sp.get("genre") ?? "action";
    
    async function fetchRawgPage(rawgPage: number): Promise<RawgListResponse> {
      switch (type) {
        case "best-of-year":
          return getRawgBestOfYear(rawgPage, RAWG_PAGE_SIZE);
        case "popular-in-year":
          return getRawgPopularInYear(year, rawgPage, RAWG_PAGE_SIZE);
        case "all-time":
          return getRawgAllTimeTop(rawgPage, RAWG_PAGE_SIZE);
        case "recent":
          return getRawgRecentReleases(rawgPage, RAWG_PAGE_SIZE);
        case "genre":
          return getRawgByGenre(genre, rawgPage, RAWG_PAGE_SIZE);
        default:
          throw new Error(`Unknown list type: ${type}`);
      }
    }
    
    // Fetch pages in parallel if needed (usually 1-2 pages)
    const pagePromises: Promise<RawgListResponse>[] = [];
    for (let p = rawgPageStart; p <= rawgPageEnd; p++) {
      pagePromises.push(fetchRawgPage(p));
    }
    
    const rawgResponses = await Promise.all(pagePromises);
    
    // Combine all results
    let allResults: RawgListItem[] = [];
    let totalCount = 0;
    
    for (let i = 0; i < rawgResponses.length; i++) {
      const resp = rawgResponses[i];
      allResults = allResults.concat(resp.results);
      if (i === 0) totalCount = resp.count; // Use count from first response
    }
    
    // Calculate offset within combined results
    const offsetInCombined = startIndex - (rawgPageStart - 1) * RAWG_PAGE_SIZE;
    
    // Slice to get exactly the items for this page
    const pageResults = allResults.slice(offsetInCombined, offsetInCombined + pageSize);

    // Filter for public safety (blocks adult/NSFW RAWG results)
    const safeResults = pageResults.filter((item) => isPublicSafeRawgGame(item));

    // Map to a lighter response format
    const items = safeResults.map((item) => ({
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
        const { getServerSupabase } = await import("@/lib/supabase/server");
        const supabase = getServerSupabase();
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
    const hasNext = endIndex < totalCount;
    
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
