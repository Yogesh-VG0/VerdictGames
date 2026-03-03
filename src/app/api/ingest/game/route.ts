/**
 * POST /api/ingest/game
 *
 * On-demand game ingestion from RAWG + Steam.
 *
 * Body: { "query": "Hades", "forceRefresh": false }
 *
 * Returns the ingestion result with game ID, slug, and status.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonBadRequest, jsonError } from "@/lib/api/response";
import { ingestGame } from "@/lib/services/ingest";

export async function POST(request: NextRequest) {
  try {
    // Validate that Supabase + RAWG are configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonError(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        503
      );
    }

    if (!process.env.RAWG_API_KEY) {
      return jsonError("RAWG_API_KEY is not configured.", 503);
    }

    // Parse body
    let body: { query?: string; forceRefresh?: boolean };
    try {
      body = await request.json();
    } catch {
      return jsonBadRequest("Invalid JSON body.");
    }

    const query = body.query?.trim();
    if (!query) {
      return jsonBadRequest('Missing required field "query".');
    }

    if (query.length < 2) {
      return jsonBadRequest("Query must be at least 2 characters.");
    }

    if (query.length > 200) {
      return jsonBadRequest("Query must be at most 200 characters.");
    }

    // Run ingestion
    const result = await ingestGame({
      query,
      forceRefresh: body.forceRefresh ?? false,
    });

    return jsonOk(result, result.success ? 200 : 422);
  } catch (err) {
    console.error("[API] /ingest/game error:", err);
    return jsonError(
      err instanceof Error ? err.message : "Internal server error.",
      500
    );
  }
}
