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
import { gxFetchCalendarMonthSnapshot } from "@/lib/external/gx-cache";
import { getGXCalendar } from "@/lib/external/gxcorner";
import { getCalendarMonthKey } from "@/lib/utils/gx-calendar";

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

  try {
    const calendarMonth = getCalendarMonthKey();
    const snapshot = await gxFetchCalendarMonthSnapshot(calendarMonth, getGXCalendar);
    log.push(`📅 Calendar snapshot warmup: ${calendarMonth} (${snapshot.items.length} items, source: ${snapshot.source})`);
  } catch (err) {
    log.push(`⚠ Calendar snapshot warmup failed: ${(err as Error).message}`);
  }

  // ── 1a. FAST-PATH: Prioritize recently released games that are under-enriched ──
  // Games released in the last 14 days with few reviews are likely major launches
  // that need post-launch enrichment ASAP (e.g. Crimson Desert: released with 61K
  // Steam reviews but our DB only had 6 from pre-launch IGDB data).
  const recentReleaseCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const { data: recentReleases } = await supabase
    .from("games")
    .select("id, title, slug, last_enriched_at, is_refreshing, refresh_started_at, is_provisional, review_count, release_date")
    .gte("release_date", recentReleaseCutoff)
    .lte("release_date", today)
    .lt("review_count", 100)               // under-enriched: fewer than 100 reviews in our DB
    .or(`is_refreshing.eq.false,is_refreshing.is.null,refresh_started_at.lt.${lockCutoff},refresh_started_at.is.null`)
    .order("release_date", { ascending: false })
    .limit(Math.min(batchLimit, 10)) as {
      data: { id: string; title: string; slug: string; last_enriched_at: string | null; is_refreshing: boolean; refresh_started_at: string | null; is_provisional: boolean; review_count: number; release_date: string }[] | null;
      error: { message: string } | null;
    };

  const fastPathIds = new Set<string>();
  const fastPathGames = (recentReleases ?? []).map(g => {
    fastPathIds.add(g.id);
    return g;
  });

  if (fastPathGames.length > 0) {
    log.push(`🚀 Fast-path: ${fastPathGames.length} recently released games prioritized for re-enrichment`);
    for (const g of fastPathGames) {
      log.push(`  ⚡ ${g.title} (released ${g.release_date}, ${g.review_count} reviews in DB)`);
    }
  }

  // ── 1b. Find remaining stale games (standard re-enrichment) ──
  const remainingSlots = batchLimit - fastPathGames.length;

  let staleGames: { id: string; title: string; slug: string; last_enriched_at: string | null; is_refreshing: boolean; refresh_started_at: string | null; is_provisional: boolean }[] = [];

  if (remainingSlots > 0) {
    const { data: staleData, error: fetchErr } = await supabase
      .from("games")
      .select("id, title, slug, last_enriched_at, is_refreshing, refresh_started_at, is_provisional")
      .or(`last_enriched_at.lt.${cutoff},last_enriched_at.is.null`)
      .or(`is_refreshing.eq.false,is_refreshing.is.null,refresh_started_at.lt.${lockCutoff},refresh_started_at.is.null`)
      .order("last_enriched_at", { ascending: true, nullsFirst: true })
      .limit(remainingSlots) as {
        data: typeof staleGames | null;
        error: { message: string } | null;
      };

    if (fetchErr) {
      return jsonError(`Failed to query stale games: ${fetchErr.message}`, 500);
    }

    // Exclude games already in the fast-path batch
    staleGames = (staleData ?? []).filter(g => !fastPathIds.has(g.id));
  }

  // Merge: fast-path games first, then standard stale games
  const allGames = [...fastPathGames, ...staleGames];

  if (allGames.length === 0) {
    return jsonOk({ message: "No stale games found", refreshed: 0, log: [] });
  }

  log.push(`Found ${allGames.length} games to re-enrich (${fastPathGames.length} fast-path + ${staleGames.length} standard)`);

  // ── 2. Process each game ──
  const { ingestGame } = await import("@/lib/services/ingest");
  let successCount = 0;
  let failCount = 0;

  for (const game of allGames) {
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
    total: allGames.length,
    fastPathCount: fastPathGames.length,
    staleCount: staleGames.length,
    log,
    timestamp: new Date().toISOString(),
  });
}
