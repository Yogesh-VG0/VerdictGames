import type { NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { jsonBadRequest, jsonOk, jsonUnavailable } from "@/lib/api/response";
import { loadSearchResults, SEARCH_PAGE_SIZE } from "@/lib/services/search";
import { boundedHomepageRead } from "@/lib/services/homepage-budget";
import { hasPublicSupabaseEnv } from "@/lib/supabase/public";
import { getPlayerGrowthEvidence, getPlayerGrowthLabelExpiry } from "@/lib/utils/trending";

function unavailable(code: string) {
  return jsonUnavailable("Trending games are temporarily unavailable.", code);
}

export async function GET(request: NextRequest) {
  const rawLimit = request.nextUrl.searchParams.get("limit") ?? "10";
  if (!/^\d{1,2}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > SEARCH_PAGE_SIZE) {
    return jsonBadRequest("Limit must be between 1 and " + SEARCH_PAGE_SIZE + ".");
  }
  if (!hasPublicSupabaseEnv()) return unavailable("catalogue_unconfigured");

  try {
    const result = await boundedHomepageRead(8500, () => loadSearchResults({
      query: "", platform: "All", genre: "", year: "", monetization: "All", sort: "trending", page: 1,
    }));
    // The card read can invalidate entries from an older ranked snapshot.
    if (result.items.length < Math.min(result.total, SEARCH_PAGE_SIZE) || result.total === 0 && result.totalIsExact === false) {
      return unavailable("catalogue_incomplete");
    }
    const games = result.items.slice(0, Number(rawLimit));
    const now = Date.now();
    let cacheSeconds = 60;
    for (const game of games) {
      const observed = game.playersUpdatedAt ?? null;
      const growth = getPlayerGrowthEvidence({
        players_updated_at: observed, current_players: game.currentPlayers ?? null, momentum: game.momentum ?? 0,
      }, now);
      if (!growth || game.trendingReason !== (growth === "fresh" ? "Trending Up" : "Past Momentum")) {
        return unavailable("catalogue_snapshot_expired");
      }
      cacheSeconds = Math.min(cacheSeconds, Math.floor((getPlayerGrowthLabelExpiry(observed, growth) - now) / 1000));
    }
    return jsonOk(games, 200, {
      cacheControl: cacheSeconds > 0 ? `public, max-age=0, s-maxage=${cacheSeconds}` : "no-store",
    });
  } catch (err) {
    unstable_rethrow(err);
    console.warn("[API] Trending catalogue read failed");
    const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")
      || typeof err === "object" && err !== null && "code" in err && err.code === "57014";
    return unavailable(timeout ? "catalogue_timeout" : "catalogue_read_failed");
  }
}
