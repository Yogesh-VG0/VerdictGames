import { jsonOk } from "@/lib/api/response";
import {
  GX_FEEDS_API_CACHE_CONTROL,
  GX_FEEDS_REVALIDATE_SECONDS,
  loadGXDeals,
} from "@/lib/services/gx-feeds";

export const revalidate = 300;

if (GX_FEEDS_REVALIDATE_SECONDS !== revalidate) {
  throw new Error("GX deals API route revalidate must match the shared GX feeds contract.");
}

export async function GET() {
  const deals = await loadGXDeals();
  return jsonOk(deals, 200, { cacheControl: GX_FEEDS_API_CACHE_CONTROL });
}
