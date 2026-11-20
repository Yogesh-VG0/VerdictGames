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
import { jsonError, PRIVATE_RESPONSE_HEADERS } from '@/lib/api/response';
import { startHomepagePhase, withHomepageTimings } from '@/lib/services/homepage-timing';

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  return withHomepageTimings(async (serverTiming) => {
    try {
      const { data, degraded } = await loadHomepageDataWithStatus();
      if (degraded && !Object.values(data).some(section => section.length > 0)) {
        const response = jsonError('Game collections are temporarily unavailable. Please retry.', 503);
        response.headers.set('Server-Timing', serverTiming());
        return response;
      }
      const endSerialization = startHomepagePhase('serialization');
      const body = JSON.stringify({ success: true, data });
      const bytes = Buffer.byteLength(body);
      endSerialization();
      return new NextResponse(body, {
        headers: {
          ...(degraded ? PRIVATE_RESPONSE_HEADERS : { 'Cache-Control': HOMEPAGE_API_CACHE_CONTROL }),
          'Content-Type': 'application/json',
          'Server-Timing': [serverTiming(), `response_bytes;desc="${bytes}"`].join(', '),
        },
      });
    } catch (err) {
      console.error("[API] /homepage error:", err);
      return jsonError('Failed to load homepage data.', 503);
    }
  });
}
