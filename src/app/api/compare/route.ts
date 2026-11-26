/**
 * GET /api/compare — Compare two games side by side
 *
 * Query params: g1 (slug), g2 (slug)
 */

export const revalidate = 300; // ISR: revalidate every 5 minutes

import { NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { jsonOk, jsonBadRequest, jsonNotFound, jsonUnavailable } from "@/lib/api/response";
import { mapGameRow } from "@/lib/db/mappers";
import { getPublicSupabase, hasPublicSupabaseEnv } from "@/lib/supabase/public";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { hasUnavailableStatus } from "@/lib/utils/release-status";
import type { GameRow } from "@/lib/supabase/types";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const g1 = params.get("g1");
  const g2 = params.get("g2");

  const slug = /^[a-z0-9-]{1,100}$/;
  if (!g1 || !g2 || !slug.test(g1) || !slug.test(g2)) return jsonBadRequest("Both g1 and g2 must be valid game slugs.");
  if (!hasPublicSupabaseEnv()) return jsonUnavailable("Comparison is temporarily unavailable.");

  try {
    const supabase = getPublicSupabase();

    const { data, error } = await supabase
      .from("games")
      .select("*")
      .in("slug", [g1, g2]) as { data: GameRow[] | null; error: unknown };

    if (error) throw error;

    const games = (data ?? []).filter(row => isPublicSafeGame(row) && !hasUnavailableStatus(row)).map(mapGameRow);

    const game1 = games.find((g) => g.slug === g1);
    const game2 = games.find((g) => g.slug === g2);

    if (!game1 || !game2) return jsonNotFound("One or both games");

    return jsonOk({ game1, game2 });
  } catch (err) {
    unstable_rethrow(err);
    return jsonUnavailable("Comparison is temporarily unavailable.");
  }
}
