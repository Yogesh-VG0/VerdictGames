import { jsonOk } from "@/lib/api/response";
import { getGXHighlights } from "@/lib/external/gxcorner";

export const revalidate = 3600;

export async function GET() {
  const highlights = await getGXHighlights();
  return jsonOk(highlights);
}
