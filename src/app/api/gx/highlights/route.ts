import { jsonOk } from "@/lib/api/response";
import { getGXHighlights } from "@/lib/external/gxcorner";
import { gxFetchWithCache } from "@/lib/external/gx-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: highlights } = await gxFetchWithCache(
    "highlights",
    getGXHighlights
  );
  return jsonOk(highlights);
}
