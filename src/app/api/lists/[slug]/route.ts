/**
 * GET /api/lists/[slug]
 *
 * Returns a single list with its games.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonNotFound } from "@/lib/api/response";
import { mapGameRow, mapListRow } from "@/lib/db/mappers";
import type { ListRow, GameRow } from "@/lib/supabase/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonNotFound("List");
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    const { data: list, error } = await supabase
      .from("lists")
      .select("*")
      .eq("slug", slug)
      .maybeSingle() as { data: ListRow | null; error: unknown };

    if (error) throw error;

    if (!list) {
      return jsonNotFound("List");
    }

    // Fetch list items with games
    const { data: items } = await supabase
      .from("list_items")
      .select("game_id, position")
      .eq("list_id", list.id)
      .order("position", { ascending: true }) as { data: { game_id: string; position: number }[] | null };

    let games: ReturnType<typeof mapGameRow>[] = [];

    if (items && items.length > 0) {
      const gameIds = items.map((i) => i.game_id);
      const { data: gamesData } = await supabase
        .from("games")
        .select("*")
        .in("id", gameIds) as { data: GameRow[] | null };

      const allGames = (gamesData ?? []).map(mapGameRow);
      games = gameIds
        .map((id) => allGames.find((g) => g.id === id))
        .filter(Boolean) as ReturnType<typeof mapGameRow>[];
    }

    return jsonOk(mapListRow(list, games));
  } catch (err) {
    console.error(`[API] /lists/${slug} error:`, err);
    return jsonNotFound("List");
  }
}
