import { jsonOk } from "@/lib/api/response";
import {
  GX_FEEDS_API_CACHE_CONTROL,
  loadGXDeals,
} from "@/lib/services/gx-feeds";

export const dynamic = "force-dynamic";

export async function GET() {
  const deals = await loadGXDeals();
  return jsonOk(deals, 200, { cacheControl: GX_FEEDS_API_CACHE_CONTROL });
}
