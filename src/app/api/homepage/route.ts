/**
 * GET /api/homepage
 *
 * Homepage aggregator — returns all homepage sections in a single call.
 * Eliminates 5+ separate API calls from the frontend.
 *
 * Returns: { hero, trending, topRated, newReleases, deals, recommendations }
 * hero and trending are distinct pools — hero feeds the carousel,
 * trending feeds the rail. They are pre-deduped server-side.
 * recommendations are genre-diverse picks for anonymous users.
 */

import { jsonOk } from "@/lib/api/response";
import { fetchHomepageData } from "@/lib/services/homepage";

export const revalidate = 60; // ISR: revalidate every 60s

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonOk({ trending: [], topRated: [], newReleases: [], deals: [], recommendations: [] });
    }

    const data = await fetchHomepageData();
    return jsonOk(data, 200, { cache: true });
  } catch (err) {
    console.error("[API] /homepage error:", err);
    return jsonOk({ trending: [], topRated: [], newReleases: [], deals: [], recommendations: [] }, 200, { cache: true });
  }
}
