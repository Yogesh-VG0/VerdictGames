/**
 * GET /api/games/[slug]/achievements
 *
 * Returns Steam achievement stats for a game — names, icons, and global unlock %.
 * Sources: ISteamUserStats/GetSchemaForGame + GetGlobalAchievementPercentagesForApp
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonNotFound, jsonError } from "@/lib/api/response";
import { getSteamAchievements } from "@/lib/external/steam";
import type { GameRow } from "@/lib/supabase/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonOk({ achievements: [], total: 0 });
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    // Fetch game to get steam_app_id
    const { data: game } = await supabase
      .from("games")
      .select("steam_app_id, title")
      .eq("slug", slug)
      .maybeSingle() as { data: Pick<GameRow, "steam_app_id" | "title"> | null };

    if (!game) return jsonNotFound("Game");
    if (!game.steam_app_id) {
      return jsonOk({ title: game.title, achievements: [], total: 0, message: "No Steam App ID." });
    }

    const achievements = await getSteamAchievements(game.steam_app_id);

    // Parse limit from query
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);

    return jsonOk({
      title: game.title,
      steamAppId: game.steam_app_id,
      total: achievements.length,
      achievements: achievements.slice(0, limit).map((a) => ({
        name: a.displayName,
        description: a.description ?? null,
        icon: a.icon,
        iconGray: a.icongray,
        globalUnlockPercent: a.percent,
      })),
    });
  } catch (err) {
    console.error(`[API] /games/${slug}/achievements error:`, err);
    return jsonError("Failed to fetch achievements.");
  }
}
