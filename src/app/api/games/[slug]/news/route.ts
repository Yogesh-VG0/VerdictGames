/**
 * GET /api/games/[slug]/news
 *
 * Returns latest Steam news/patch notes for a game.
 * Source: ISteamNews/GetNewsForApp
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonNotFound, jsonError } from "@/lib/api/response";
import { getSteamNews } from "@/lib/external/steam";
import type { GameRow } from "@/lib/supabase/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonOk({ news: [] });
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
      return jsonOk({ title: game.title, news: [], message: "No Steam App ID — news not available." });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const count = Math.min(parseInt(searchParams.get("count") ?? "5"), 20);

    const newsItems = await getSteamNews(game.steam_app_id, count, 600);

    const news = newsItems.map((item) => ({
      id: item.gid,
      title: item.title,
      url: item.url,
      author: item.author,
      contents: item.contents,
      feedLabel: item.feedlabel,
      date: new Date(item.date * 1000).toISOString(),
      tags: item.tags ?? [],
    }));

    return jsonOk({
      title: game.title,
      steamAppId: game.steam_app_id,
      news,
    });
  } catch (err) {
    console.error(`[API] /games/${slug}/news error:`, err);
    return jsonError("Failed to fetch news.");
  }
}
