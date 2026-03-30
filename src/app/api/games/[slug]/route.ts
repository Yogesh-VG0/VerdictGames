/**
 * GET /api/games/[slug]
 *
 * Returns a single game by slug, with related games.
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonNotFound } from "@/lib/api/response";
import {
  GAME_DETAIL_API_CACHE_CONTROL,
  GAME_DETAIL_REVALIDATE_SECONDS,
  loadGameDetail,
  parseGameDetailRawgId,
} from "@/lib/services/game-detail";

export const revalidate = 60;

if (GAME_DETAIL_REVALIDATE_SECONDS !== revalidate) {
  throw new Error("Game detail API revalidate must stay aligned with the shared game detail loader.");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const rawgId = parseGameDetailRawgId(request.nextUrl.searchParams.get("rawgId"));

  try {
    const detail = await loadGameDetail({ slug, rawgId });

    if (detail.status !== "ok") {
      return jsonNotFound("Game");
    }

    return NextResponse.json(
      { success: true, data: detail.game },
      {
        status: 200,
        headers: {
          "Cache-Control": GAME_DETAIL_API_CACHE_CONTROL,
          "X-Verdict-Requested-Slug": detail.requestedSlug,
          "X-Verdict-Canonical-Slug": detail.canonicalSlug,
          "X-Verdict-Resolved-Via": detail.resolvedVia,
        },
      }
    );
  } catch (err) {
    console.error(`[API] /games/${slug} error:`, err);
    return jsonNotFound("Game");
  }
}

