/**
 * GET /api/games/[slug]/system-requirements
 *
 * Returns parsed system requirements from Steam's appdetails API.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { getSteamAppDetails, extractSystemRequirements } from "@/lib/external/steam";
import { boundedHomepageRead } from "@/lib/services/homepage-budget";
import { getPublicSupabase, hasPublicSupabaseEnv } from "@/lib/supabase/public";

export const maxDuration = 10;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    return await boundedHomepageRead(5000, async () => {
      if (!hasPublicSupabaseEnv()) return jsonError("System requirements temporarily unavailable", 503);
      const { data: game, error } = await getPublicSupabase()
        .from("games").select("steam_app_id, title").eq("slug", slug)
        .abortSignal(AbortSignal.timeout(1500)).maybeSingle();
      if (error) throw error;
      if (!game?.steam_app_id) return jsonOk({ requirements: null });
      const appData = await getSteamAppDetails(game.steam_app_id, true);
      return jsonOk({
        title: game.title,
        steamAppId: game.steam_app_id,
        requirements: appData ? extractSystemRequirements(appData) : null,
      });
    });
  } catch (err) {
    console.error(`[API] /games/${slug}/system-requirements error:`, err);
    return jsonError("System requirements temporarily unavailable", 503);
  }
}
