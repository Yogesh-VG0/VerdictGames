import { jsonOk } from "@/lib/api/response";
import {
  GX_FEEDS_API_CACHE_CONTROL,
  GX_FEEDS_REVALIDATE_SECONDS,
  loadGXDeals,
} from "@/lib/services/gx-feeds";

export const revalidate = GX_FEEDS_REVALIDATE_SECONDS;

export async function GET() {
  const deals = await loadGXDeals();
  return jsonOk(deals, 200, { cacheControl: GX_FEEDS_API_CACHE_CONTROL });
}
