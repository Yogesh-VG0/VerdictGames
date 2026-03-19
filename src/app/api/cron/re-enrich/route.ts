/**
 * GET /api/cron/re-enrich
 *
 * Cron endpoint: finds stale games (last_enriched_at > 24h ago) and
 * re-enriches them in batch. Replaces the unreliable on-demand background
 * refresh that previously ran inside GET /api/games/[slug].
 *
 * Designed to run every 6 hours via Vercel Cron / Heroku Scheduler.
 *
 * Query params:
 *   secret  — must match CRON_SECRET
 *   limit   — max games to re-enrich per run (default 10, max 50)
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";

export const maxDuration = 300; // 5 min max for Vercel

export async function GET(request: NextRequest) {
  // ── Auth ──
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return jsonError("CRON_SECRET not configured", 503);
  }
  const provided =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("authorization")?.replace("Bearer ", "");
  if (provided !== cronSecret) {
    return jsonError("Unauthorized", 401);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError("Supabase not configured", 503);
  }

  const limitParam = parseInt(request.nextUrl.searchParams.get("limit") ?? "10", 10);
  const batchLimit = Math.min(Math.max(1, limitParam), 50);

  const { getServerSupabase } = await import("@/lib/supabase/server");
  const supabase = getServerSupabase();

  const log: string[] = [];
  const STALE_HOURS = 24;
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();
  const lockCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min lock TTL

  // ── 1. Find stale games that need re-enrichment ──
  // Prioritize: games marked needs_enrichment first, then oldest enrichment, then provisional games
  const { data: staleGames, error: fetchErr } = await supabase
    .from("games")
    .select("id, title, slug, last_enriched_at, is_refreshing, refresh_started_at, is_provisional")
    .or(`last_enriched_at.lt.${cutoff},last_enriched_at.is.null`)
    .or(`is_refreshing.eq.false,is_refreshing.is.null,refresh_started_at.lt.${lockCutoff},refresh_started_at.is.null`)
    .order("last_enriched_at", { ascending: true, nullsFirst: true })
    .limit(batchLimit) as {
      data: { id: string; title: string; slug: string; last_enriched_at: string | null; is_refreshing: boolean; refresh_started_at: string | null; is_provisional: boolean }[] | null;
      error: { message: string } | null;
    };

  if (fetchErr) {
    return jsonError(`Failed to query stale games: ${fetchErr.message}`, 500);
  }

  if (!staleGames || staleGames.length === 0) {
    return jsonOk({ message: "No stale games found", refreshed: 0, log: [] });
  }

  log.push(`Found ${staleGames.length} stale games to re-enrich`);

  // ── 2. Process each game ──
  const { ingestGame } = await import("@/lib/services/ingest");
  let successCount = 0;
  let failCount = 0;

  for (const game of staleGames) {
    const now = new Date().toISOString();

    // Acquire lock
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: locked } = await (supabase.from("games") as any)
        .update({ is_refreshing: true, refresh_started_at: now })
        .eq("id", game.id)
        .or(`is_refreshing.eq.false,is_refreshing.is.null,refresh_started_at.lt.${lockCutoff},refresh_started_at.is.null`)
        .select("id")
        .maybeSingle();

      if (!locked) {
        log.push(`⏭ ${game.title} — already locked, skipping`);
        continue;
      }
    } catch {
      // Lock columns may not exist on older schemas, proceed anyway
    }

    // Re-enrich
    try {
      const result = await ingestGame({ query: game.title, forceRefresh: true });
      if (result.success) {
        successCount++;
        log.push(`✓ ${game.title} — re-enriched (sources: ${result.slug})`);
      } else {
        failCount++;
        log.push(`✗ ${game.title} — ${result.message}`);
      }
    } catch (err) {
      failCount++;
      log.push(`✗ ${game.title} — error: ${(err as Error).message}`);
    } finally {
      // Release lock
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("games") as any)
          .update({ is_refreshing: false, refresh_started_at: null })
          .eq("id", game.id);
      } catch {
        /* column may not exist */
      }
    }

    // Rate limit: 500ms between games to avoid hammering external APIs
    await new Promise((r) => setTimeout(r, 500));
  }

  return jsonOk({
    refreshed: successCount,
    failed: failCount,
    total: staleGames.length,
    log,
    timestamp: new Date().toISOString(),
  });
}
