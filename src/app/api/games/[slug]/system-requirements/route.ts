/**
 * GET /api/games/[slug]/system-requirements
 *
 * Returns parsed system requirements from Steam's appdetails API.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { getSteamAppDetails, extractSystemRequirements } from "@/lib/external/steam";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return jsonOk({ requirements: null });
    }

    const { getPublicSupabase } = await import("@/lib/supabase/public");
    const supabase = getPublicSupabase();

    const { data: game } = await supabase
      .from("games")
      .select("steam_app_id, title")
      .eq("slug", slug)
      .maybeSingle();

    if (!game?.steam_app_id) {
      return jsonOk({ requirements: null, message: "No Steam App ID" });
    }

    const appData = await getSteamAppDetails(game.steam_app_id);
    if (!appData) {
      return jsonOk({ requirements: null, message: "Could not fetch Steam data" });
    }

    const requirements = extractSystemRequirements(appData);

    return jsonOk({
      title: game.title,
      steamAppId: game.steam_app_id,
      requirements,
    });
  } catch (err) {
    console.error(`[API] /games/${slug}/system-requirements error:`, err);
    return jsonError("Failed to fetch system requirements.");
  }
}
