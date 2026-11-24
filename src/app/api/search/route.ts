import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { parseSearchPageState } from "@/lib/search";
import { loadSearchResults, SEARCH_API_CACHE_CONTROL, SEARCH_REVALIDATE_SECONDS } from "@/lib/services/search";
import { boundedHomepageRead } from "@/lib/services/homepage-budget";

export const revalidate = 300;
export const maxDuration = 15;

if (SEARCH_REVALIDATE_SECONDS !== revalidate) {
  throw new Error("Search API route revalidate must match the shared search loader contract.");
}

export async function GET(request: NextRequest) {
  const state = parseSearchPageState(request.nextUrl.searchParams);

  try {
    const data = await boundedHomepageRead(8500, () => loadSearchResults(state.games));

    return NextResponse.json(
      { success: true, data },
      {
        status: 200,
        headers: {
          "Cache-Control": data.notice && state.games.sort === "upcoming" ? "no-store" : SEARCH_API_CACHE_CONTROL,
        },
      }
    );
  } catch (error) {
    console.error("[API] /search error:", error);

    return jsonError("Browse results are temporarily unavailable.", 503);
  }
}
