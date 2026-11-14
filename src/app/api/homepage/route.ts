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
  HOMEPAGE_API_CACHE_CONTROL,
  loadHomepageDataWithStatus,
} from "@/lib/services/homepage";
import { jsonPrivateOk, jsonError } from '@/lib/api/response';

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const { data, degraded } = await loadHomepageDataWithStatus();
    if (degraded) {
      if (!Object.values(data).some(section => section.length > 0)) return jsonError('Game collections are temporarily unavailable. Please retry.', 503);
      return jsonPrivateOk(data);
    }
    return NextResponse.json(
      { success: true, data },
      { status: 200, headers: { "Cache-Control": HOMEPAGE_API_CACHE_CONTROL } }
    );
  } catch (err) {
    console.error("[API] /homepage error:", err);
    return jsonError('Failed to load homepage data.', 503);
  }
}
