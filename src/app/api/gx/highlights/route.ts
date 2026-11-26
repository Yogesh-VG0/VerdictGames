import { jsonOk, jsonUnavailable } from "@/lib/api/response";
import { getGXHighlights } from "@/lib/external/gxcorner";
import { gxFetchWithCache } from "@/lib/external/gx-cache";
import {
  GX_FEEDS_API_CACHE_CONTROL,
  GX_FEEDS_REVALIDATE_SECONDS,
} from "@/lib/services/gx-feeds";

export const revalidate = 300;
// This route depends on an external provider. Keep its CDN/data cache, but do
// not make a provider outage block a production build.
export const dynamic = "force-dynamic";

if (GX_FEEDS_REVALIDATE_SECONDS !== revalidate) {
  throw new Error("GX highlights API route revalidate must match the shared GX feeds contract.");
}

export async function GET() {
  const { data: highlights, source } = await gxFetchWithCache(
    "highlights",
    getGXHighlights
  );
  if (source === "empty") return jsonUnavailable("Highlights feed is temporarily unavailable.");
  return jsonOk(highlights, 200, { cacheControl: GX_FEEDS_API_CACHE_CONTROL });
}
