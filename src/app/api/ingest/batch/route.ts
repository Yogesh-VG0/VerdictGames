/**
 * POST /api/ingest/batch
 *
 * Batch game ingestion. Accepts an array of game queries.
 *
 * Body: { "queries": ["Hades", "Elden Ring", "Stardew Valley"] }
 *
 * Processes sequentially with rate limiting. Returns results array.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonBadRequest, jsonError } from "@/lib/api/response";
import { ingestMultipleGames } from "@/lib/services/ingest";

export async function POST(request: NextRequest) {
  try {
    // Auth check — require CRON_SECRET to prevent abuse
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return jsonError("CRON_SECRET not configured", 503);
    }
    const provided =
      request.nextUrl.searchParams.get("secret") ??
      request.headers.get("authorization")?.replace("Bearer ", "");
    if (provided !== secret) {
      return jsonError("Unauthorized", 401);
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonError("Supabase is not configured.", 503);
    }

    if (!process.env.RAWG_API_KEY) {
      return jsonError("RAWG_API_KEY is not configured.", 503);
    }

    let body: { queries?: string[] };
    try {
      body = await request.json();
    } catch {
      return jsonBadRequest("Invalid JSON body.");
    }

    if (!Array.isArray(body.queries) || body.queries.length === 0) {
      return jsonBadRequest('Missing or empty "queries" array.');
    }

    if (body.queries.length > 50) {
      return jsonBadRequest("Maximum 50 games per batch.");
    }

    const queries = body.queries
      .map((q) => (typeof q === "string" ? q.trim() : ""))
      .filter((q) => q.length >= 2);

    if (queries.length === 0) {
      return jsonBadRequest("No valid queries after filtering.");
    }

    const results = await ingestMultipleGames(queries);

    const summary = {
      total: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      alreadyExisted: results.filter((r) => r.alreadyExisted).length,
      results,
    };

    return jsonOk(summary);
  } catch (err) {
    console.error("[API] /ingest/batch error:", err);
    return jsonError(
      err instanceof Error ? err.message : "Internal server error.",
      500
    );
  }
}
