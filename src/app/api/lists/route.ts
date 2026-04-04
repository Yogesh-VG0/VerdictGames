/**
 * GET /api/lists
 *
 * Returns all curated game lists.
 */

export const dynamic = "force-dynamic";

import { jsonOk } from "@/lib/api/response";
import { mapGameRow, mapListRow } from "@/lib/db/mappers";
import { GAME_CARD_COLUMNS_WITH_DESC } from "@/lib/db/columns";
import { passesCuratedListSelection } from "@/lib/utils/curatedLists";
import { dedupePublicCanonicalRows } from "@/lib/utils/publicCanonical";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { hasUsableCardImage } from "@/lib/utils/mediaReadiness";
import type { ListRow, GameRow } from "@/lib/supabase/types";

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return jsonOk([]);
    }

    const { getPublicSupabase } = await import("@/lib/supabase/public");
    const supabase = getPublicSupabase();

    // Batch: fetch all lists + all list_items in parallel (2 queries instead of N*2)
    const [listsRes, itemsRes] = await Promise.all([
      supabase
        .from("lists")
        .select("*")
        .eq("is_public", true)
        .order("is_system_managed", { ascending: false })
        .order("last_seeded_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
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

    // Single batch query for all games (with description for filtering)
    const gamesMap = new Map<string, GameRow>();
    if (allGameIds.size > 0) {
      const { data: gamesData } = await supabase
        .from("games")
        .select(GAME_CARD_COLUMNS_WITH_DESC)
        .in("id", [...allGameIds]) as { data: GameRow[] | null };

      // Apply public safety + media readiness filters
      for (const row of gamesData ?? []) {
        if (isPublicSafeGame(row) && hasUsableCardImage(row)) {
          gamesMap.set(row.id, row);
        }
      }
    }

    // Assemble results
    const results = listsData.map((list) => {
      const items = itemsByList.get(list.id) ?? [];
      const orderedRows = items
        .map((item) => gamesMap.get(item.game_id))
        .filter(Boolean) as GameRow[];
      const visibleRows = orderedRows.filter((row) => passesCuratedListSelection(list, row));
      return mapListRow(list, dedupePublicCanonicalRows(visibleRows).map(mapGameRow));
    });

    return jsonOk(results, 200, { cache: true });
  } catch (err) {
    console.error("[API] /lists error:", err);
    return jsonOk([]);
  }
}
