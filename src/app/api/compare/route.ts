/**
 * GET /api/compare — Compare two games side by side
 *
 * Query params: g1 (slug), g2 (slug)
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonBadRequest, jsonNotFound } from "@/lib/api/response";
import { mapGameRow } from "@/lib/db/mappers";
import type { GameRow } from "@/lib/supabase/types";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const g1 = params.get("g1");
  const g2 = params.get("g2");

  if (!g1 || !g2) return jsonBadRequest("Both g1 and g2 slug params are required");

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonNotFound("Games");
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    const { data, error } = await supabase
      .from("games")
      .select("*")
      .in("slug", [g1, g2]) as { data: GameRow[] | null; error: unknown };

    if (error) throw error;

    const games = (data ?? []).map(mapGameRow);

    const game1 = games.find((g) => g.slug === g1);
    const game2 = games.find((g) => g.slug === g2);

    if (!game1 || !game2) return jsonNotFound("One or both games not found");

    return jsonOk({ game1, game2 });
  } catch (err) {
    console.error("[API] /compare error:", err);
    return jsonNotFound("Games");
  }
}
