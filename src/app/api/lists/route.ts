/**
 * GET /api/lists
 *
 * Returns all curated game lists.
 */

export const revalidate = 300; // ISR: revalidate every 5 minutes

import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api/response";
import { mapGameRow, mapListRow } from "@/lib/db/mappers";
import { GAME_CARD_COLUMNS } from "@/lib/db/columns";
import type { ListRow, GameRow } from "@/lib/supabase/types";

export async function GET(_request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonOk([]);
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    // Batch: fetch all lists + all list_items in parallel (2 queries instead of N*2)
    const [listsRes, itemsRes] = await Promise.all([
      supabase.from("lists").select("*").order("created_at", { ascending: false }),
      supabase.from("list_items").select("list_id, game_id, position").order("position", { ascending: true }),
    ]);

    if (listsRes.error) throw listsRes.error;
    const listsData = listsRes.data as ListRow[] | null;
    if (!listsData || listsData.length === 0) return jsonOk([]);

    // Group list_items by list_id
    const itemsByList = new Map<string, { game_id: string; position: number }[]>();
    for (const item of (itemsRes.data ?? []) as { list_id: string; game_id: string; position: number }[]) {
      const arr = itemsByList.get(item.list_id) ?? [];
      arr.push(item);
      itemsByList.set(item.list_id, arr);
    }

    // Collect all unique game IDs across all lists
    const allGameIds = new Set<string>();
    for (const items of itemsByList.values()) {
      for (const item of items) allGameIds.add(item.game_id);
    }

    // Single batch query for all games (with card columns only)
    const gamesMap = new Map<string, ReturnType<typeof mapGameRow>>();
    if (allGameIds.size > 0) {
      const { data: gamesData } = await supabase
        .from("games")
        .select(GAME_CARD_COLUMNS)
        .in("id", [...allGameIds]) as { data: GameRow[] | null };

      for (const row of gamesData ?? []) {
        gamesMap.set(row.id, mapGameRow(row));
      }
    }

    // Assemble results
    const results = listsData.map((list) => {
      const items = itemsByList.get(list.id) ?? [];
      const orderedGames = items
        .map((item) => gamesMap.get(item.game_id))
        .filter(Boolean) as ReturnType<typeof mapGameRow>[];
      return mapListRow(list, orderedGames);
    });

    return jsonOk(results, 200, { cache: true });
  } catch (err) {
    console.error("[API] /lists error:", err);
    return jsonOk([]);
  }
}
