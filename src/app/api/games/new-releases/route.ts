/**
 * GET /api/games/new-releases
 *
 * Returns games released within the last 2 years, sorted by release date.
 * Falls back to 5 years if insufficient recent games.
 */

import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api/response";
import { mapGameRow } from "@/lib/db/mappers";
import type { GameRow } from "@/lib/supabase/types";

function dateCutoff(yearsBack: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsBack);
  return d.toISOString().slice(0, 10);
}

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

    // Try last 2 years first (truly new releases)
    let { data, error } = await supabase
      .from("games")
      .select("*")
      .not("release_date", "is", null)
      .lte("release_date", new Date().toISOString().slice(0, 10))
      .gte("release_date", dateCutoff(2))
      .order("release_date", { ascending: false })
      .limit(limit) as { data: GameRow[] | null; error: unknown };

    // Fallback to 5 years if insufficient results
    if (!error && (!data || data.length < limit)) {
      const fallback = await supabase
        .from("games")
        .select("*")
        .not("release_date", "is", null)
        .lte("release_date", new Date().toISOString().slice(0, 10))
        .gte("release_date", dateCutoff(5))
        .order("release_date", { ascending: false })
        .limit(limit) as { data: GameRow[] | null; error: unknown };

      if (!fallback.error && fallback.data && fallback.data.length > (data?.length ?? 0)) {
        data = fallback.data;
        error = fallback.error;
      }
    }

    if (error) throw error;

    const games = (data ?? []).map(mapGameRow);

    return jsonOk(games);
  } catch (err) {
    console.error("[API] /games/new-releases error:", err);
    return jsonOk([]);
  }
}
