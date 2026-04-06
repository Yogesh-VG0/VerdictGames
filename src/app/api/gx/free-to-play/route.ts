import { jsonOk } from "@/lib/api/response";
import {
  GX_FEEDS_API_CACHE_CONTROL,
  GX_FEEDS_REVALIDATE_SECONDS,
  loadGXFreeToPlay,
} from "@/lib/services/gx-feeds";

export const revalidate = GX_FEEDS_REVALIDATE_SECONDS;

export async function GET() {
  const games = await loadGXFreeToPlay();
  return jsonOk(games, 200, { cacheControl: GX_FEEDS_API_CACHE_CONTROL });
}
