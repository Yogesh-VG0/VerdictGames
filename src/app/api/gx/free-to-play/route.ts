import { jsonOk } from "@/lib/api/response";
import {
  GX_FEEDS_API_CACHE_CONTROL,
  loadGXFreeToPlay,
} from "@/lib/services/gx-feeds";

export const dynamic = "force-dynamic";

export async function GET() {
  const games = await loadGXFreeToPlay();
  return jsonOk(games, 200, { cacheControl: GX_FEEDS_API_CACHE_CONTROL });
}
