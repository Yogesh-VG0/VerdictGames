/**
 * GET /api/games/[slug]/news
 *
 * Returns latest Steam news/patch notes for a game.
 * Source: ISteamNews/GetNewsForApp
 */

import { NextRequest } from "next/server";
import { jsonBadRequest, jsonOk, jsonNotFound, jsonUnavailable } from "@/lib/api/response";
import { getSteamNews } from "@/lib/external/steam";
import type { GameRow } from "@/lib/supabase/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const count = Number(request.nextUrl.searchParams.get("count") ?? "5");
  if (!Number.isSafeInteger(count) || count < 1) return jsonBadRequest("Invalid news item count.");

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return jsonUnavailable("Game news temporarily unavailable.");
    }

    const { getPublicSupabase } = await import("@/lib/supabase/public");
    const supabase = getPublicSupabase();

    // Fetch game to get steam_app_id
    const { data: game, error } = await supabase
      .from("games")
      .select("steam_app_id, title")
      .eq("slug", slug)
      .maybeSingle() as { data: Pick<GameRow, "steam_app_id" | "title"> | null; error: unknown };

    if (error) throw error;
    if (!game) return jsonNotFound("Game");
    if (!game.steam_app_id) {
      return jsonOk({ title: game.title, news: [], message: "No Steam App ID — news not available." });
    }

    const newsItems = await getSteamNews(game.steam_app_id, Math.min(count, 20), 600);

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
    return jsonUnavailable("Game news temporarily unavailable.");
  }
}
