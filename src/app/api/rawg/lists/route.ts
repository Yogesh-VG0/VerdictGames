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
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const type = sp.get("type") ?? "best-of-year";
  const page = parseInt(sp.get("page") ?? "1", 10);
  const pageSize = Math.min(parseInt(sp.get("pageSize") ?? "20", 10), 40);

  try {
    const {
      getRawgBestOfYear,
      getRawgPopularInYear,
      getRawgAllTimeTop,
      getRawgRecentReleases,
      getRawgByGenre,
    } = await import("@/lib/external/rawg");

    let data;

    switch (type) {
      case "best-of-year":
        data = await getRawgBestOfYear(page, pageSize);
        break;
      case "popular-in-year": {
        const year = parseInt(sp.get("year") ?? String(new Date().getFullYear() - 1), 10);
        data = await getRawgPopularInYear(year, page, pageSize);
        break;
      }
      case "all-time":
        data = await getRawgAllTimeTop(page, pageSize);
        break;
      case "recent":
        data = await getRawgRecentReleases(page, pageSize);
        break;
      case "genre": {
        const genre = sp.get("genre") ?? "action";
        data = await getRawgByGenre(genre, page, pageSize);
        break;
      }
      default:
        return jsonError(`Unknown list type: ${type}`, 400);
    }

    // Map to a lighter response format
    const items = data.results.map((item) => ({
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

    return jsonOk({
      count: data.count,
      page,
      pageSize,
      hasNext: !!data.next,
      items,
    });
  } catch (err) {
    return jsonError((err as Error).message, 500);
  }
}
