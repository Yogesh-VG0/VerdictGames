/**
 * GET /api/cron/refresh-trending
 *
 * Auto-updates trending & featured flags using IGDB PopScore + RAWG data.
 * Designed to run daily via Vercel Cron.
 *
 * Flow:
 * 1. Fetch IGDB PopScore (visits, want-to-play, playing, steam peak players)
 * 2. Cross-reference with our database
 * 3. Fallback to RAWG trending + recency-weighted scoring
 * 4. Update trending/featured flags in Supabase
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

async function fetchRawgTrending(apiKey: string): Promise<{ name: string; slug: string }[]> {
  const params = new URLSearchParams({
    key: apiKey,
    ordering: "-added",
    page_size: "30",
    dates: dateRange(90),
  });
  try {
    const res = await fetch(`${RAWG_BASE}/games?${params}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results ?? []).map((g: { name: string; slug: string }) => ({
      name: g.name,
      slug: g.slug,
    }));
  } catch {
    return [];
  }
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
  // Auth check
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided =
      request.nextUrl.searchParams.get("secret") ??
      request.headers.get("authorization")?.replace("Bearer ", "");
    if (provided !== cronSecret) {
      return jsonError("Unauthorized", 401);
    }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError("Supabase not configured", 503);
  }

  const { getServerSupabase } = await import("@/lib/supabase/server");
  const supabase = getServerSupabase();

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

  // ── 2. RAWG fallback for more matches ──
  if (trendingIds.length < 20 && process.env.RAWG_API_KEY) {
    const rawgGames = await fetchRawgTrending(process.env.RAWG_API_KEY);
    log.push(`RAWG returned ${rawgGames.length} trending games`);

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
      }
    }
  }

  // ── 3. Fill remaining with recency-weighted high-scored games ──
  if (trendingIds.length < 20) {
    const needed = 20 - trendingIds.length;
    log.push(`Filling ${needed} remaining slots with recency-weighted games`);

    // Get recent well-scored games not already selected
    const { data: fillGames } = await supabase
      .from("games")
      .select("id, title, score, release_date")
      .not("id", "in", `(${trendingIds.join(",")})`)
      .not("release_date", "is", null)
      .gte("release_date", new Date(Date.now() - 4 * 365 * 86400000).toISOString().slice(0, 10))
      .order("score", { ascending: false })
      .limit(needed * 2);

    if (fillGames) {
      // Sort by combined recency + score
      const scored = (fillGames as { id: string; title: string; score: number; release_date: string }[]).map((g) => {
        const ageMs = Date.now() - new Date(g.release_date).getTime();
        const ageDays = ageMs / 86400000;
        const recencyBonus = ageDays < 180 ? 40 : ageDays < 365 ? 30 : ageDays < 730 ? 20 : 10;
        return { ...g, combined: g.score * 0.25 + recencyBonus };
      });
      scored.sort((a, b) => b.combined - a.combined);

      for (const g of scored.slice(0, needed)) {
        trendingIds.push(g.id);
        log.push(`  + [fill] ${g.title} (score: ${g.score})`);
      }
    }
  }

  // ── 4. Reset all flags, then apply ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gamesTable = supabase.from("games") as any;
  await gamesTable.update({ trending: false, featured: false }).neq("id", "00000000-0000-0000-0000-000000000000");

  if (trendingIds.length > 0) {
    // Mark trending
    for (const id of trendingIds) {
      await gamesTable.update({ trending: true }).eq("id", id);
    }
  }

  // ── 5. Featured = top 5 trending by score ──
  const { data: featuredGames } = await supabase
    .from("games")
    .select("id, title, score")
    .eq("trending", true)
    .order("score", { ascending: false })
    .limit(5);

  if (featuredGames) {
    for (const g of (featuredGames as { id: string; title: string; score: number }[])) {
      await gamesTable.update({ featured: true }).eq("id", g.id);
      log.push(`⭐ Featured: ${g.title} (${g.score})`);
    }
  }

  return jsonOk({
    trendingCount: trendingIds.length,
    featuredCount: featuredGames?.length ?? 0,
    log,
    timestamp: new Date().toISOString(),
  });
}
