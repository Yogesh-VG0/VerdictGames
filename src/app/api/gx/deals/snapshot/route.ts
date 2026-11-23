import { jsonError, jsonOk } from "@/lib/api/response";
import { GX_FEEDS_API_CACHE_CONTROL, loadHomepageDeals } from "@/lib/services/gx-feeds";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk(await loadHomepageDeals(), 200, { cacheControl: GX_FEEDS_API_CACHE_CONTROL });
  } catch {
    return jsonError("Deals are temporarily unavailable.", 503);
  }
}
