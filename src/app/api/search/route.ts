import { NextRequest, NextResponse } from "next/server";
import { parseSearchPageState } from "@/lib/search";
import { loadSearchResults, SEARCH_API_CACHE_CONTROL, SEARCH_REVALIDATE_SECONDS } from "@/lib/services/search";

export const revalidate = 30;

if (SEARCH_REVALIDATE_SECONDS !== revalidate) {
  throw new Error("Search API route revalidate must match the shared search loader contract.");
}

export async function GET(request: NextRequest) {
  const state = parseSearchPageState(request.nextUrl.searchParams);

  try {
    const data = await loadSearchResults(state.games);

    return NextResponse.json(
      { success: true, data },
      {
        status: 200,
        headers: {
          "Cache-Control": SEARCH_API_CACHE_CONTROL,
        },
      }
    );
  } catch (error) {
    console.error("[API] /search error:", error);

    return NextResponse.json(
      { success: false, error: "Failed to load search results." },
      { status: 500 }
    );
  }
}
