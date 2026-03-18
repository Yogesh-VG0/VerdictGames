/**
 * GET /api/games/trending
 *
 * Returns trending games using a hybrid approach:
 * Primary: games with `trending` flag, ranked by a blend of score + live players.
 * Fallback: freshness-scored ranking favoring recent, popular games.
 */

import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api/response";
import { mapGameRow } from "@/lib/db/mappers";
import type { GameRow } from "@/lib/supabase/types";

const DECAY_DAYS = 365;

function deduplicateBySteamAppId(games: GameRow[]): GameRow[] {
  const byAppId = new Map<number, GameRow>();
  for (const g of games) {
    const appId = g.steam_app_id;
    if (appId == null) continue;
    const existing = byAppId.get(appId);
    if (!existing || (g.release_date && (!existing.release_date || g.release_date > existing.release_date))) {
      byAppId.set(appId, g);
    }
  }
  const chosenIds = new Set(Array.from(byAppId.values()).map((g) => g.id));
  return games.filter((g) => g.steam_app_id == null || chosenIds.has(g.id));
}

function trendingRank(g: GameRow, minPlayers: number, maxPlayers: number): number {
  const score = g.score ?? 0;
  const playerCount = g.current_players ?? 0;
  const logPlayers = Math.log10(playerCount + 1);
  const logMin = Math.log10(Math.max(minPlayers, 0) + 1);
  const logMax = Math.log10(Math.max(maxPlayers, 1) + 1);
  const spread = logMax - logMin || 1;
  const playerScore = Math.min(100, ((logPlayers - logMin) / spread) * 100);
  const ageMs = Date.now() - new Date(g.release_date ?? "2000-01-01").getTime();
  const ageDays = ageMs / 86400000;
  const recency = Math.min(100, Math.exp(-ageDays / DECAY_DAYS) * 100);
  return (score * 0.3) + (playerScore * 0.4) + (recency * 0.3);
}

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
      .limit(40) as { data: GameRow[] | null; error: unknown };

    if (error) throw error;

    if (data && data.length >= 3) {
      const deduped = deduplicateBySteamAppId(data);
      const players = deduped.map((g) => g.current_players ?? 0);
      const minPlayers = Math.min(...players);
      const maxPlayers = Math.max(1, ...players);
      const ranked = [...deduped].sort((a, b) => trendingRank(b, minPlayers, maxPlayers) - trendingRank(a, minPlayers, maxPlayers));
      return jsonOk(ranked.slice(0, limit).map(mapGameRow), 200, { cache: true });
    }

    // Fallback: recency-weighted scoring from recent games pool
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
      return jsonOk((data ?? []).map(mapGameRow), 200, { cache: true });
    }

    const allForMax = [...(data ?? []), ...pool];
    const players = allForMax.map((g) => g.current_players ?? 0);
    const minPlayers = Math.min(...players);
    const maxPlayers = Math.max(1, ...players);
    const scored = pool.map((g) => ({ row: g, rank: trendingRank(g, minPlayers, maxPlayers) }));
    scored.sort((a, b) => b.rank - a.rank);

    const alreadyIncluded = new Set((data ?? []).map((d) => d.id));
    const fallbackGames = scored
      .filter((s) => !alreadyIncluded.has(s.row.id))
      .slice(0, limit - (data?.length ?? 0))
      .map((s) => s.row);

    const combined = deduplicateBySteamAppId([...(data ?? []), ...fallbackGames]);
    const reranked = combined.sort((a, b) => trendingRank(b, minPlayers, maxPlayers) - trendingRank(a, minPlayers, maxPlayers));
    return jsonOk(reranked.slice(0, limit).map(mapGameRow), 200, { cache: true });
  } catch (err) {
    console.error("[API] /games/trending error:", err);
    return jsonOk([], 200, { cache: true });
  }
}
