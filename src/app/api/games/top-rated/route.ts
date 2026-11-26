import type { NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { jsonBadRequest, jsonOk, jsonUnavailable } from "@/lib/api/response";
import { fetchTopRated } from "@/lib/services/homepage";
import { hasPublicSupabaseEnv } from "@/lib/supabase/public";

export async function GET(request: NextRequest) {
  const rawLimit = request.nextUrl.searchParams.get("limit") ?? "16";
  if (!/^\d{1,2}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 50) {
    return jsonBadRequest("Limit must be between 1 and 50.");
  }
  if (!hasPublicSupabaseEnv()) return jsonUnavailable("Top-rated games are temporarily unavailable.");

  try {
    const games = await fetchTopRated(Number(rawLimit));
    return jsonOk(games, 200, { cache: true });
  } catch (err) {
    unstable_rethrow(err);
    console.warn("[API] Top-rated games catalogue read failed");
    return jsonUnavailable("Top-rated games are temporarily unavailable.");
  }
}
