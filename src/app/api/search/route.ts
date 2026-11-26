import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { jsonUnavailable } from "@/lib/api/response";
import { parseSearchPageState } from "@/lib/search";
import { loadSearchResults, SEARCH_API_CACHE_CONTROL, SEARCH_REVALIDATE_SECONDS } from "@/lib/services/search";
import { boundedHomepageRead } from "@/lib/services/homepage-budget";
import { hasPublicSupabaseEnv } from "@/lib/supabase/public";

export const revalidate = 300;
export const maxDuration = 15;

if (SEARCH_REVALIDATE_SECONDS !== revalidate) {
  throw new Error("Search API route revalidate must match the shared search loader contract.");
}

export async function GET(request: NextRequest) {
  const state = parseSearchPageState(request.nextUrl.searchParams);
  if (!hasPublicSupabaseEnv()) return jsonUnavailable("Browse results are temporarily unavailable.");

  try {
    const data = await boundedHomepageRead(8500, () => loadSearchResults(state.games));

    return NextResponse.json(
      { success: true, data },
      {
        status: 200,
        headers: {
          "Cache-Control": state.games.sort === "trending" || data.notice && state.games.sort === "upcoming"
            ? "no-store" : SEARCH_API_CACHE_CONTROL,
        },
      }
    );
  } catch (error) {
    unstable_rethrow(error);
    console.warn("[API] Browse catalogue read failed");
    return jsonUnavailable("Browse results are temporarily unavailable.");
  }
}
