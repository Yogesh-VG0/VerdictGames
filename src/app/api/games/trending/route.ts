/**
 * GET /api/games/trending
 *
 * Returns trending games. Uses the `trending` flag set by seed-flags.
 * Falls back to recency-weighted scoring if no games are flagged.
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
      request.nextUrl.searchParams.get("limit") ?? "10",
      10
    );

    // Primary: games with trending flag
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("trending", true)
      .order("score", { ascending: false })
      .limit(limit) as { data: GameRow[] | null; error: unknown };

    if (error) throw error;

    // Fallback: if no trending games, use recent games with good scores
    if (!data || data.length === 0) {
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 3);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      const { data: fallback, error: fbErr } = await supabase
        .from("games")
        .select("*")
        .gte("release_date", cutoffStr)
        .order("score", { ascending: false })
        .limit(limit) as { data: GameRow[] | null; error: unknown };

      if (fbErr) throw fbErr;
      return jsonOk((fallback ?? []).map(mapGameRow));
    }

    const games = data.map(mapGameRow);
    return jsonOk(games);
  } catch (err) {
    console.error("[API] /games/trending error:", err);
    return jsonOk([]);
  }
}
