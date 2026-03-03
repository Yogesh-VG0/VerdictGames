/**
 * GET /api/games/new-releases
 *
 * Returns games sorted by release date descending.
 */

import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api/response";
import { mapGameRow } from "@/lib/db/mappers";
import type { GameRow } from "@/lib/supabase/types";

export async function GET(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonOk([]);
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    const limit = parseInt(
      request.nextUrl.searchParams.get("limit") ?? "8",
      10
    );

    const { data, error } = await supabase
      .from("games")
      .select("*")
      .order("release_date", { ascending: false })
      .limit(limit) as { data: GameRow[] | null; error: unknown };

    if (error) throw error;

    const games = (data ?? []).map(mapGameRow);

    return jsonOk(games);
  } catch (err) {
    console.error("[API] /games/new-releases error:", err);
    return jsonOk([]);
  }
}
