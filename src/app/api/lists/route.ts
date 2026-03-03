/**
 * GET /api/lists
 *
 * Returns all curated game lists.
 */

import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api/response";
import { mapGameRow, mapListRow } from "@/lib/db/mappers";
import type { ListRow, GameRow } from "@/lib/supabase/types";

export async function GET(_request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonOk([]);
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    // Get all lists
    const { data: listsData, error: listsError } = await supabase
      .from("lists")
      .select("*")
      .order("created_at", { ascending: false }) as { data: ListRow[] | null; error: unknown };

    if (listsError) throw listsError;

    if (!listsData || listsData.length === 0) {
      return jsonOk([]);
    }

    // For each list, fetch its games
    const results = await Promise.all(
      listsData.map(async (list) => {
        const { data: items } = await supabase
          .from("list_items")
          .select("game_id, position")
          .eq("list_id", list.id)
          .order("position", { ascending: true }) as { data: { game_id: string; position: number }[] | null };

        if (!items || items.length === 0) {
          return mapListRow(list, []);
        }

        const gameIds = items.map((i) => i.game_id);
        const { data: gamesData } = await supabase
          .from("games")
          .select("*")
          .in("id", gameIds) as { data: GameRow[] | null };

        const games = (gamesData ?? []).map(mapGameRow);

        // Sort games by list position
        const orderedGames = gameIds
          .map((id) => games.find((g) => g.id === id))
          .filter(Boolean) as ReturnType<typeof mapGameRow>[];

        return mapListRow(list, orderedGames);
      })
    );

    return jsonOk(results);
  } catch (err) {
    console.error("[API] /lists error:", err);
    return jsonOk([]);
  }
}
