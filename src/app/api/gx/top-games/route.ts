import { jsonError, jsonOk } from "@/lib/api/response";
import { boundedHomepageRead } from "@/lib/services/homepage-budget";
import {
  GX_FEEDS_API_CACHE_CONTROL,
  GX_FEEDS_REVALIDATE_SECONDS,
  loadGXTopGames,
} from "@/lib/services/gx-feeds";

export const revalidate = 300;
export const maxDuration = 15;
// This route depends on an external provider. Keep its CDN/data cache, but do
// not make a provider outage block a production build.
export const dynamic = "force-dynamic";

if (GX_FEEDS_REVALIDATE_SECONDS !== revalidate) {
  throw new Error("GX top-games API route revalidate must match the shared GX feeds contract.");
}

export async function GET() {
  try {
    const data = await boundedHomepageRead(9000, loadGXTopGames);
    return jsonOk(data, 200, { cacheControl: GX_FEEDS_API_CACHE_CONTROL });
  } catch {
    return jsonError("Feed temporarily unavailable. Please try again.", 503);
  }
}
