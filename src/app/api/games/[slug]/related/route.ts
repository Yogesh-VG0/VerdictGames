import { NextRequest, NextResponse } from "next/server";
import { jsonError, jsonNotFound } from "@/lib/api/response";
import { boundedHomepageRead } from "@/lib/services/homepage-budget";
import { loadRelatedGameTarget } from "@/lib/services/game-detail";
import { relatedFailureReason, type RelatedStage } from "@/lib/services/related-errors";
import {
  getRelatedGamesForGame,
  RELATED_GAMES_API_CACHE_CONTROL,
  RELATED_GAMES_REVALIDATE_SECONDS,
} from "@/lib/services/relatedGames";

export const revalidate = 300;
export const maxDuration = 15;

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

  let stage: RelatedStage = "game-resolution";
  try {
    const target = await boundedHomepageRead(4500, () => loadRelatedGameTarget(slug));

    if (!target) {
      return jsonNotFound("Game");
    }

    stage = "candidate-lookup";
    const related = await boundedHomepageRead(3500, () => getRelatedGamesForGame(target, limit));

    return NextResponse.json(
      { success: true, data: related },
      {
        status: 200,
        headers: {
          "Cache-Control": RELATED_GAMES_API_CACHE_CONTROL,
          "X-Verdict-Canonical-Slug": target.slug,
        },
      }
    );
  } catch (err) {
    console.error("[Related games] Request failed", { stage, reason: relatedFailureReason(stage, err) });
    return jsonError("Related games temporarily unavailable", 503);
  }
}
