/**
 * GET /api/lists/[slug]
 *
 * Returns a single list with its games.
 */

export const revalidate = 300; // ISR: revalidate every 5 minutes

import { NextRequest } from "next/server";
import { jsonOk, jsonNotFound } from "@/lib/api/response";
import { mapGameRow, mapListRow } from "@/lib/db/mappers";
import { GAME_CARD_COLUMNS_WITH_DESC } from "@/lib/db/columns";
import { passesCuratedListSelection } from "@/lib/utils/curatedLists";
import { dedupePublicCanonicalRows } from "@/lib/utils/publicCanonical";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { hasUsableCardImage } from "@/lib/utils/mediaReadiness";
import type { ListRow, GameRow } from "@/lib/supabase/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return jsonNotFound("List");
    }

    const { getPublicSupabase } = await import("@/lib/supabase/public");
    const supabase = getPublicSupabase();

    const { data: list, error } = await supabase
      .from("lists")
      .select("*")
      .eq("slug", slug)
      .eq("is_public", true)
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
        .select(GAME_CARD_COLUMNS_WITH_DESC)
        .in("id", gameIds) as { data: GameRow[] | null };

      // Filter for surface readiness + public safety + media readiness
      const rowsById = new Map(
        (gamesData ?? [])
          .filter((r) =>
            isPublicSafeGame(r) &&
            hasUsableCardImage(r)
          )
          .map((row) => [row.id, row])
      );
      const orderedRows = gameIds
        .map((id) => rowsById.get(id))
        .filter(Boolean) as GameRow[];
      const visibleRows = orderedRows.filter((row) => passesCuratedListSelection(list, row));
      const allGames = dedupePublicCanonicalRows(visibleRows)
        .map(mapGameRow);
      games = allGames;
    }

    return jsonOk(mapListRow(list, games), 200, { cache: true });
  } catch (err) {
    console.error(`[API] /lists/${slug} error:`, err);
    return jsonNotFound("List");
  }
}
