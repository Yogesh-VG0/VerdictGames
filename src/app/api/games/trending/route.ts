import type { NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { jsonBadRequest, jsonOk, jsonUnavailable } from "@/lib/api/response";
import { loadSearchResults, SEARCH_PAGE_SIZE } from "@/lib/services/search";
import { hasPublicSupabaseEnv } from "@/lib/supabase/public";

function unavailable() {
  return jsonUnavailable("Trending games are temporarily unavailable.");
}

export async function GET(request: NextRequest) {
  const rawLimit = request.nextUrl.searchParams.get("limit") ?? "10";
  if (!/^\d{1,2}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > SEARCH_PAGE_SIZE) {
    return jsonBadRequest("Limit must be between 1 and " + SEARCH_PAGE_SIZE + ".");
  }
  if (!hasPublicSupabaseEnv()) return unavailable();

  try {
    const result = await loadSearchResults({
      query: "", platform: "All", genre: "", year: "", monetization: "All", sort: "trending", page: 1,
    });
    // The card read can invalidate entries from an older ranked snapshot.
    if (result.items.length < Math.min(result.total, SEARCH_PAGE_SIZE) || result.total === 0 && result.totalIsExact === false) {
      return unavailable();
    }
    const games = result.items.slice(0, Number(rawLimit));
    const now = Date.now();
    const cacheSeconds = games.reduce((limit, game) => {
      const age = now - Date.parse(game.playersUpdatedAt ?? "");
      if (!Number.isFinite(age) || age < 0) return 0;
      const window = game.trendingReason === "Trending Up" ? 86_400_000 : 7 * 86_400_000;
      return Math.min(limit, Math.max(0, Math.floor((window - age) / 1000)));
    }, 60);
    return jsonOk(games, 200, {
      cacheControl: cacheSeconds > 0 ? `public, max-age=0, s-maxage=${cacheSeconds}` : "no-store",
    });
  } catch (err) {
    unstable_rethrow(err);
    console.warn("[API] Trending catalogue read failed");
    return unavailable();
  }
}
