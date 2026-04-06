import { jsonOk } from "@/lib/api/response";
import {
  GX_FEEDS_API_CACHE_CONTROL,
  GX_FEEDS_REVALIDATE_SECONDS,
  loadGXTopGames,
} from "@/lib/services/gx-feeds";

export const revalidate = 300;

if (GX_FEEDS_REVALIDATE_SECONDS !== revalidate) {
  throw new Error("GX top-games API route revalidate must match the shared GX feeds contract.");
}

export async function GET() {
  const games = await loadGXTopGames();
  return jsonOk(games, 200, { cacheControl: GX_FEEDS_API_CACHE_CONTROL });
}
