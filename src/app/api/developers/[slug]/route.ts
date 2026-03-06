/**
 * GET /api/developers/[slug] — Developer hub page data
 *
 * Returns all games by a developer with aggregate stats.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonNotFound } from "@/lib/api/response";
import { mapGameRow } from "@/lib/db/mappers";
import type { GameRow } from "@/lib/supabase/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const name = slug.replace(/-/g, " ");

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonNotFound("Developer");
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    // Case-insensitive search on developer name
    const { data, error } = await supabase
      .from("games")
      .select("*")
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
