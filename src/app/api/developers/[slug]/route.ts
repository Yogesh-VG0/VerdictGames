/**
 * GET /api/developers/[slug] — Developer hub page data
 *
 * Returns all games by a developer with aggregate stats.
 */

export const revalidate = 300; // ISR: revalidate every 5 minutes

import { NextRequest } from "next/server";
import { jsonOk, jsonNotFound } from "@/lib/api/response";
import { mapGameRow } from "@/lib/db/mappers";
import { GAME_CARD_COLUMNS } from "@/lib/db/columns";
import type { GameRow } from "@/lib/supabase/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  // Sanitize: strip characters that could break PostgREST .ilike() syntax
  const name = slug.replace(/-/g, " ").replace(/[%_(),.;'"\\]/g, "").trim();

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return jsonNotFound("Developer");
    }

    const { getPublicSupabase } = await import("@/lib/supabase/public");
    const supabase = getPublicSupabase();

    // Case-insensitive search on developer name
    const { data, error } = await supabase
      .from("games")
      .select(GAME_CARD_COLUMNS)
      .ilike("developer", `%${name}%`)
      .order("release_date", { ascending: false }) as { data: GameRow[] | null; error: unknown };

    if (error) throw error;

    const games = (data ?? []).map(mapGameRow);

    if (games.length === 0) return jsonNotFound("Developer");

    const avgScore = Math.round(
      games.reduce((sum, g) => sum + g.score, 0) / games.length
    );

    return jsonOk({
      name: games[0].developer,
      slug,
      gameCount: games.length,
      averageScore: avgScore,
      games,
    });
  } catch (err) {
    console.error("[API] /developers/[slug] error:", err);
    return jsonNotFound("Developer");
  }
}
