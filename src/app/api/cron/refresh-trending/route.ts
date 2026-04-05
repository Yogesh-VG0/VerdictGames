/**
 * GET /api/cron/refresh-trending
 *
 * Auto-updates trending flags using IGDB PopScore + RAWG data.
 * NOTE: Featured flags are editorial-only (is_featured_manual) and NEVER derived from trending.
 * Designed to run daily via Vercel Cron.
 *
 * Flow:
 * 1. Fetch IGDB PopScore (visits, want-to-play, playing, steam peak players)
 * 2. Cross-reference with our database
 * 3. Fallback to RAWG trending + recency-weighted scoring
 * 4. Update trending flags in Supabase (featured is editorial-only, not touched here)
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";

const RAWG_BASE = "https://api.rawg.io/api";

function dateRange(daysBack: number): string {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - daysBack);
  return `${from.toISOString().slice(0, 10)},${now.toISOString().slice(0, 10)}`;
}

type RawgTrendingItem = {
  name: string;
  slug: string;
  rating: number;
  ratingsCount: number;
  released: string | null;
  genres: string[];
};

async function fetchRawgTrending(apiKey: string): Promise<RawgTrendingItem[]> {
  const params = new URLSearchParams({
    key: apiKey,
    ordering: "-added",
    page_size: "50",
    dates: dateRange(90),
  });
  try {
    const res = await fetch(`${RAWG_BASE}/games?${params}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results ?? []).map((g: { name: string; slug: string; rating?: number; ratings_count?: number; released?: string | null; genres?: { slug: string }[] }) => ({
      name: g.name,
      slug: g.slug,
      rating: g.rating ?? 0,
      ratingsCount: g.ratings_count ?? 0,
      released: g.released ?? null,
      genres: (g.genres ?? []).map((x) => x.slug).filter(Boolean),
    }));
  } catch {
    return [];
  }
}

const DECAY_DAYS = 365;

function rawgIngestPriority(g: RawgTrendingItem, genrePenalty = 1): number {
  const ratingScore = Math.min(100, (g.rating ?? 0) * 20);
  const reviewScore = Math.min(100, Math.log10(g.ratingsCount + 1) * 15);
  const ageMs = g.released ? Date.now() - new Date(g.released).getTime() : 0;
  const ageDays = Math.max(0, ageMs / 86400000);
  const recencyScore = Math.min(100, Math.exp(-ageDays / DECAY_DAYS) * 100);
  const base = (ratingScore * 0.4) + (reviewScore * 0.3) + (recencyScore * 0.3);
  return base * genrePenalty;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(request: NextRequest) {
  // Require CRON_SECRET for production security
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


  const { getServerSupabase } = await import("@/lib/supabase/server");
  const supabase = getServerSupabase();

  // ── Idempotency guard: skip if a successful run completed within 30 minutes ──
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schedulerTable = supabase.from("scheduler_runs") as any;
  const { data: recentRun } = await schedulerTable
    .select("id, finished_at")
    .eq("job_name", "refresh-trending")
    .eq("status", "success")
    .gte("finished_at", thirtyMinAgo)
    .limit(1) as { data: { id: string; finished_at: string }[] | null };

  if (recentRun && recentRun.length > 0) {
    return jsonOk({
      skipped: true,
      reason: "A successful run completed within the last 30 minutes",
      lastRun: recentRun[0].finished_at,
    });
  }

  // Record run start
  const runStartedAt = new Date().toISOString();
  const { data: runRecord } = await schedulerTable
    .insert({
      job_name: "refresh-trending",
      started_at: runStartedAt,
      status: "running",
    })
    .select("id")
    .single() as { data: { id: string } | null };
  const runId = runRecord?.id;

  const trendingIds: string[] = [];
  const log: string[] = [];

  // ── 1. Try IGDB PopScore ──
  try {
    const { getTrendingFromIgdb } = await import("@/lib/external/igdb");
    const igdbTrending = await getTrendingFromIgdb(40);

    if (igdbTrending.length > 0) {
      log.push(`IGDB PopScore returned ${igdbTrending.length} games`);

      for (const igdbGame of igdbTrending) {
        if (trendingIds.length >= 20) break;

        const ourSlug = slugify(igdbGame.name);

        // Match by slug
        const { data: matchRows } = await supabase
          .from("games")
          .select("id, title")
          .or(`slug.eq.${igdbGame.slug},slug.eq.${ourSlug}`)
          .limit(1);

        const match = (matchRows as { id: string; title: string }[] | null)?.[0];
        if (match) {
          trendingIds.push(match.id);
          log.push(`  ✓ [IGDB] ${match.title} (pop: ${igdbGame.popScore.toFixed(3)})`);
          continue;
        }

        // Try name match
        const { data: nameRows } = await supabase
          .from("games")
          .select("id, title")
          .ilike("title", igdbGame.name)
          .limit(1);

        const nameMatch = (nameRows as { id: string; title: string }[] | null)?.[0];
        if (nameMatch) {
          trendingIds.push(nameMatch.id);
          log.push(`  ✓ [IGDB name] ${nameMatch.title}`);
        }
      }
    }
  } catch (err) {
    log.push(`IGDB PopScore error: ${(err as Error).message}`);
  }

  // ── 1b. GX Top Liked signal ──
  try {
    const { getGXTopLiked } = await import("@/lib/external/gxcorner");
    const gxGames = await getGXTopLiked();

    if (gxGames.length > 0) {
      log.push(`GX Top Liked returned ${gxGames.length} games`);

      for (const gxGame of gxGames) {
        if (trendingIds.length >= 20) break;

        const gxSlug = slugify(gxGame.title);
        const { data: gxRows } = await supabase
          .from("games")
          .select("id, title")
          .or(`slug.eq.${gxGame.slug},slug.eq.${gxSlug}`)
          .limit(1);

        const gxMatch = (gxRows as { id: string; title: string }[] | null)?.[0];
        if (gxMatch && !trendingIds.includes(gxMatch.id)) {
          trendingIds.push(gxMatch.id);
          log.push(`  ✓ [GX] ${gxMatch.title} (likes: ${gxGame.likesCount})`);
          continue;
        }

        if (!gxMatch) {
          const { data: nameRows } = await supabase
            .from("games")
            .select("id, title")
            .ilike("title", gxGame.title)
            .limit(1);

          const nameMatch = (nameRows as { id: string; title: string }[] | null)?.[0];
          if (nameMatch && !trendingIds.includes(nameMatch.id)) {
            trendingIds.push(nameMatch.id);
            log.push(`  ✓ [GX name] ${nameMatch.title}`);
          }
        }
      }
    }
  } catch (err) {
    log.push(`GX Top Liked error: ${(err as Error).message}`);
  }

  // ── 2. RAWG fallback — match existing + ingest missing ──
  if (trendingIds.length < 20 && process.env.RAWG_API_KEY) {
    const rawgGames = await fetchRawgTrending(process.env.RAWG_API_KEY);
    log.push(`RAWG returned ${rawgGames.length} trending games`);

    const missingGames: RawgTrendingItem[] = [];

    for (const rg of rawgGames) {
      if (trendingIds.length >= 20) break;

      const ourSlug = slugify(rg.name);
      const { data: rawgRows } = await supabase
        .from("games")
        .select("id, title")
        .or(`slug.eq.${rg.slug},slug.eq.${ourSlug}`)
        .limit(1);

      const rmatch = (rawgRows as { id: string; title: string }[] | null)?.[0];
      if (rmatch && !trendingIds.includes(rmatch.id)) {
        trendingIds.push(rmatch.id);
        log.push(`  ✓ [RAWG] ${rmatch.title}`);
      } else if (!rmatch) {
        missingGames.push(rg);
      }
    }

    // Ingest missing RAWG trending games — prioritize by rating, review count, recency + diversity
    if (missingGames.length > 0 && trendingIds.length < 20) {
      const sorted = [...missingGames].sort((a, b) => rawgIngestPriority(b, 1) - rawgIngestPriority(a, 1));
      const toPick = Math.min(5, 20 - trendingIds.length);
      const toIngest: RawgTrendingItem[] = [];
      const remaining = [...sorted];
      const seenGenres = new Set<string>();
      for (let i = 0; i < toPick && remaining.length > 0; i++) {
        let best: RawgTrendingItem | null = null;
        let bestScore = -1;
        for (const g of remaining) {
          const overlapCount = g.genres.filter((gen) => seenGenres.has(gen)).length;
          const genrePenalty = overlapCount > 0 ? Math.max(0.7, 1 - overlapCount * 0.1) : 1;
          const score = rawgIngestPriority(g, genrePenalty);
          if (score > bestScore) {
            bestScore = score;
            best = g;
          }
        }
        if (best) {
          toIngest.push(best);
          best.genres.forEach((gen) => seenGenres.add(gen));
          remaining.splice(remaining.indexOf(best), 1);
        }
      }
      log.push(`Ingesting ${toIngest.length} missing trending games from RAWG`);

      const { ingestGame } = await import("@/lib/services/ingest");
      for (const mg of toIngest) {
        try {
          const result = await ingestGame({ query: mg.name, expectedSlug: mg.slug });
          if (result.success && result.gameId && !trendingIds.includes(result.gameId)) {
            trendingIds.push(result.gameId);
            log.push(`  + [RAWG ingest] ${mg.name} → ${result.slug} (new: ${!result.alreadyExisted})`);
          }
        } catch (err) {
          log.push(`  ✗ [RAWG ingest] ${mg.name} failed: ${(err as Error).message}`);
        }
      }
    }
  }

  // ── 3. Fill remaining using freshnessScore (recency * 0.2 + rating * 0.2 + popularity * 0.2 + gxBoost * 0.4) ──
  if (trendingIds.length < 20) {
    const needed = 20 - trendingIds.length;
    log.push(`Filling ${needed} remaining slots with freshnessScore`);

    const excludeClause = trendingIds.length > 0
      ? `(${trendingIds.join(",")})`
      : "(00000000-0000-0000-0000-000000000000)";

    const { data: fillGames } = await supabase
      .from("games")
      .select("id, title, score, verdict_score, release_date, current_players, is_featured_manual, is_trending_manual")
      .not("id", "in", excludeClause)
      .not("release_date", "is", null)
      .gte("release_date", new Date(Date.now() - 4 * 365 * 86400000).toISOString().slice(0, 10))
      .order("verdict_score", { ascending: false, nullsFirst: false })
      .order("score", { ascending: false })
      .limit(needed * 3) as unknown as { data: { id: string; title: string; score: number; verdict_score: number | null; release_date: string; current_players: number | null; is_featured_manual?: boolean; is_trending_manual?: boolean }[] | null };

    if (fillGames) {
      type FillGame = { id: string; title: string; score: number; verdict_score: number | null; release_date: string; current_players: number | null; is_featured_manual?: boolean; is_trending_manual?: boolean };
      const scored = (fillGames as FillGame[]).map((g) => {
        const ageMs = Date.now() - new Date(g.release_date).getTime();
        const ageDays = ageMs / 86400000;
        const recencyScore = ageDays < 30 ? 100 : ageDays < 90 ? 80 : ageDays < 180 ? 60 : ageDays < 365 ? 40 : ageDays < 730 ? 20 : 10;
        const ratingScore = g.verdict_score ?? g.score;
        const popularityScore = g.current_players ? Math.min(100, g.current_players / 1000) : 0;
        const manualBoost = (g.is_trending_manual || g.is_featured_manual) ? 100 : 0;

        const freshness = (recencyScore * 0.3) + (ratingScore * 0.3) + (popularityScore * 0.2) + (manualBoost * 0.2);
        return { ...g, freshness };
      });
      scored.sort((a, b) => b.freshness - a.freshness);

      for (const g of scored.slice(0, needed)) {
        trendingIds.push(g.id);
        log.push(`  + [freshness] ${g.title} (score: ${g.score}, freshness: ${g.freshness.toFixed(1)})`);
      }
    }
  }

  // ── 4. Reset algorithmic trending flags (preserving manual overrides) ──
  // NOTE: Featured is editorial-only (is_featured_manual). We NEVER touch featured here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gamesTable = supabase.from("games") as any;
  await gamesTable.update({ trending: false })
    .eq("is_trending_manual", false)
    .eq("trending", true);

  if (trendingIds.length > 0) {
    // Mark trending
    await gamesTable.update({ trending: true }).in("id", trendingIds);
  }

  // ── 5. Featured is editorial-only — just log count for observability ──
  const { data: featuredGames } = await supabase
    .from("games")
    .select("id, title")
    .eq("is_featured_manual", true)
    .limit(20);

  const featuredCount = featuredGames?.length ?? 0;
  log.push(`⭐ Featured (editorial): ${featuredCount} games with is_featured_manual=true`);

  // ── 6. Momentum Tracking — snapshot + compute ──
  try {
    // Fetch all games with current player data
    const { data: gamesWithPlayers } = await supabase
      .from("games")
      .select("id, title, current_players")
      .not("current_players", "is", null)
      .gt("current_players", 0)
      .limit(500) as { data: { id: string; title: string; current_players: number }[] | null };

    if (gamesWithPlayers && gamesWithPlayers.length > 0) {
      // Throttle: check if we already have a snapshot in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentSnapshot } = await supabase
        .from("player_snapshots")
        .select("id")
        .gte("recorded_at", oneHourAgo)
        .limit(1);

      if (!recentSnapshot || recentSnapshot.length === 0) {
        // Insert hourly snapshots
        const snapshots = gamesWithPlayers.map((g) => ({
          game_id: g.id,
          player_count: g.current_players,
        }));
        await supabase.from("player_snapshots").insert(snapshots);
        log.push(`📸 Snapshotted ${snapshots.length} player counts`);
      } else {
        log.push("📸 Snapshot skipped (already have one within the last hour)");
      }

      // Compute momentum for each game: log(current+1) - log(previous+1)
      const { data: momentumUpdated, error: momentumError } = await ((supabase as any).rpc("refresh_recent_game_momentum") as Promise<{ data: number | null; error: { message: string } | null }>);
      if (momentumError) throw momentumError;
      log.push(`📈 Updated momentum for ${momentumUpdated} games`);
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: deletedCount } = await supabase
      .from("player_snapshots")
      .delete({ count: "exact" })
      .lt("recorded_at", sevenDaysAgo) as unknown as { count: number | null };
    if ((deletedCount ?? 0) > 0) {
      log.push(`🗑️ Cleaned up ${deletedCount} old snapshots`);
    }
  } catch (err) {
    log.push(`Momentum tracking error: ${(err as Error).message}`);
  }

  // ── Record run completion ──
  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - new Date(runStartedAt).getTime();
  if (runId) {
    await schedulerTable
      .update({
        finished_at: finishedAt,
        status: "success",
        duration_ms: durationMs,
        rows_updated: trendingIds.length,
        metadata: { featuredCount, logLines: log.length },
      })
      .eq("id", runId);
  }

  return jsonOk({
    trendingCount: trendingIds.length,
    featuredCount,
    log,
    durationMs,
    timestamp: finishedAt,
  });
}
