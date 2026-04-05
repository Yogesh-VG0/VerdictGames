import { jsonOk } from "@/lib/api/response";
import { getGXHighlights } from "@/lib/external/gxcorner";
import { gxFetchWithCache } from "@/lib/external/gx-cache";
import { GX_FEEDS_API_CACHE_CONTROL } from "@/lib/services/gx-feeds";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: highlights } = await gxFetchWithCache(
    "highlights",
    getGXHighlights
  );
  return jsonOk(highlights, 200, { cacheControl: GX_FEEDS_API_CACHE_CONTROL });
}
