/**
 * GET /api/developers/[slug] — Developer hub page data
 *
 * Returns all games by a developer with aggregate stats.
 */

export const revalidate = 300; // ISR: revalidate every 5 minutes

import { NextRequest } from "next/server";
import { jsonOk, jsonNotFound } from "@/lib/api/response";
import { jsonError } from '@/lib/api/response';
import { loadDeveloperHub } from '@/lib/services/developers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const hub = await loadDeveloperHub(slug);
    return hub ? jsonOk(hub, 200, { cacheControl: 's-maxage=900, stale-while-revalidate=3600' }) : jsonNotFound('Developer');
  } catch (err) {
    console.error("[API] /developers/[slug] error:", err);
    return jsonError('Developer data temporarily unavailable', 503);
  }
}
