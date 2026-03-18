/**
 * GET /api/games/trending
 *
 * Returns trending games using a recency-weighted scoring formula.
 * Primary: games with `trending` flag (set by cron).
 * Fallback: freshness-scored ranking favoring recent, popular games.
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

    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("trending", true)
      .order("score", { ascending: false })
      .limit(limit) as { data: GameRow[] | null; error: unknown };

    if (error) throw error;

    if (data && data.length >= 3) {
      return jsonOk(data.map(mapGameRow));
    }

    // Fallback: recency-weighted scoring instead of pure score ranking
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 4);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const { data: pool, error: poolErr } = await supabase
      .from("games")
      .select("*")
      .not("release_date", "is", null)
      .gte("release_date", cutoffStr)
      .lte("release_date", new Date().toISOString().slice(0, 10))
      .gt("score", 0)
      .order("release_date", { ascending: false })
      .limit(100) as { data: GameRow[] | null; error: unknown };

    if (poolErr) throw poolErr;

    if (!pool || pool.length === 0) {
      return jsonOk((data ?? []).map(mapGameRow));
    }

    const now = Date.now();
    const scored = pool.map((g) => {
      const ageMs = now - new Date(g.release_date ?? "2000-01-01").getTime();
      const ageDays = ageMs / 86400000;
      const recency = ageDays < 30 ? 100 : ageDays < 90 ? 85 : ageDays < 180 ? 65 : ageDays < 365 ? 40 : ageDays < 730 ? 20 : 10;
      const rating = g.score ?? 0;
      const popularity = Math.min(100, (g.current_players ?? 0) / 500);
      const freshness = (recency * 0.35) + (rating * 0.35) + (popularity * 0.3);
      return { row: g, freshness };
    });

    scored.sort((a, b) => b.freshness - a.freshness);

    const alreadyIncluded = new Set((data ?? []).map((d) => d.id));
    const fallbackGames = scored
      .filter((s) => !alreadyIncluded.has(s.row.id))
      .slice(0, limit - (data?.length ?? 0))
      .map((s) => s.row);

    const combined = [...(data ?? []), ...fallbackGames];
    return jsonOk(combined.map(mapGameRow));
  } catch (err) {
    console.error("[API] /games/trending error:", err);
    return jsonOk([]);
  }
}
