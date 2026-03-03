/**
 * GET /api/games/[slug]
 *
 * Returns a single game by slug, with related games.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonNotFound } from "@/lib/api/response";
import { mapGameRow } from "@/lib/db/mappers";
import type { GameRow } from "@/lib/supabase/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonNotFound("Game");
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("slug", slug)
      .maybeSingle() as { data: GameRow | null; error: unknown };

    if (error) throw error;

    if (!data) {
      return jsonNotFound("Game");
    }

    return jsonOk(mapGameRow(data));
  } catch (err) {
    console.error(`[API] /games/${slug} error:`, err);
    return jsonNotFound("Game");
  }
}
