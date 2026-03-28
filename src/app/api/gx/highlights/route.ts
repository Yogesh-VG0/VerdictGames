import { jsonOk } from "@/lib/api/response";
import { getGXHighlights } from "@/lib/external/gxcorner";
import { gxFetchWithCache } from "@/lib/external/gx-cache";

export const revalidate = 3600;

export async function GET() {
  const { data: highlights } = await gxFetchWithCache(
    "highlights",
    getGXHighlights
  );
  return jsonOk(highlights);
}
