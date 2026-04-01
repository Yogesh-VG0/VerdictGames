import { NextRequest, NextResponse } from "next/server";
import { jsonNotFound } from "@/lib/api/response";
import { loadGameDetail } from "@/lib/services/game-detail";
import {
  getRelatedGamesForGame,
  RELATED_GAMES_API_CACHE_CONTROL,
  RELATED_GAMES_REVALIDATE_SECONDS,
} from "@/lib/services/relatedGames";

export const revalidate = 300;

if (RELATED_GAMES_REVALIDATE_SECONDS !== revalidate) {
  throw new Error("Related games API revalidate must stay aligned with the shared related-games loader.");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const parsedLimit = Number(request.nextUrl.searchParams.get("limit") ?? "4");
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 4;

  try {
    const detail = await loadGameDetail({ slug });

    if (detail.status !== "ok") {
      return jsonNotFound("Game");
    }

    const related = await getRelatedGamesForGame(detail.game, limit);

    return NextResponse.json(
      { success: true, data: related },
      {
        status: 200,
        headers: {
          "Cache-Control": RELATED_GAMES_API_CACHE_CONTROL,
          "X-Verdict-Canonical-Slug": detail.canonicalSlug,
        },
      }
    );
  } catch (err) {
    console.error(`[API] /games/${slug}/related error:`, err);
    return jsonNotFound("Game");
  }
}
