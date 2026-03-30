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

import { NextResponse } from "next/server";
import {
  EMPTY_HOMEPAGE_DATA,
  HOMEPAGE_API_CACHE_CONTROL,
  HOMEPAGE_REVALIDATE_SECONDS,
  loadHomepageData,
} from "@/lib/services/homepage";

export const revalidate = 60;

if (HOMEPAGE_REVALIDATE_SECONDS !== revalidate) {
  throw new Error("Homepage API route revalidate must stay aligned with the shared homepage loader.");
}

export async function GET() {
  try {
    const data = await loadHomepageData();
    return NextResponse.json(
      { success: true, data },
      { status: 200, headers: { "Cache-Control": HOMEPAGE_API_CACHE_CONTROL } }
    );
  } catch (err) {
    console.error("[API] /homepage error:", err);
    return NextResponse.json(
      { success: true, data: EMPTY_HOMEPAGE_DATA },
      { status: 200, headers: { "Cache-Control": HOMEPAGE_API_CACHE_CONTROL } }
    );
  }
}
