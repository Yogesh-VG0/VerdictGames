/**
 * GET /api/cron/discover
 *
 * Auto-discovery endpoint: fetches the latest, trending, and upcoming games
 * from RAWG and ingests any that aren't already in the database.
 *
 * Designed to be called by a cron job (e.g., Vercel Cron, GitHub Actions).
 * Optional secret: ?secret=YOUR_CRON_SECRET
 *
 * Returns how many new games were discovered and ingested.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { ingestGame } from "@/lib/services/ingest";

const RAWG_BASE = "https://api.rawg.io/api";

interface RawgListResult {
  id: number;
  name: string;
  slug: string;
  released: string | null;
  rating: number;
}

async function fetchRawgList(
  endpoint: string,
  params: Record<string, string> = {},
  limit = 20
): Promise<RawgListResult[]> {
  const key = process.env.RAWG_API_KEY!;
  const qs = new URLSearchParams({
    key,
    page_size: String(limit),
    ...params,
  });

  try {
    const res = await fetch(`${RAWG_BASE}/${endpoint}?${qs}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.results ?? [];
  } catch {
    return [];
  }
}

function formatDateRange(daysBack: number, daysForward: number): string {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - daysBack);
  const to = new Date(now);
  to.setDate(to.getDate() + daysForward);
  return `${from.toISOString().slice(0, 10)},${to.toISOString().slice(0, 10)}`;
}

export async function GET(request: NextRequest) {
  // Optional secret check for production security
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided = request.nextUrl.searchParams.get("secret");
    if (provided !== cronSecret) {
      return jsonError("Unauthorized", 401);
    }
  }

  if (!process.env.RAWG_API_KEY) {
    return jsonError("RAWG_API_KEY not configured", 503);
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const lastMonth = formatDateRange(30, 0);
  const upcoming = formatDateRange(0, 90);
  const recentWindow = formatDateRange(90, 0);

  // Fetch multiple lists in parallel from RAWG
  const [trending, newReleases, upcomingGames, topThisYear, popularAllTime] =
    await Promise.all([
      // Currently trending/popular
      fetchRawgList("games", {
        ordering: "-added",
        dates: recentWindow,
      }, 20),
      // Recently released
      fetchRawgList("games", {
        ordering: "-released",
        dates: lastMonth,
      }, 15),
      // Upcoming releases
      fetchRawgList("games", {
        ordering: "-added",
        dates: upcoming,
      }, 10),
      // Top rated this year
      fetchRawgList("games", {
        ordering: "-rating",
        dates: `${currentYear}-01-01,${currentYear}-12-31`,
        metacritic: "70,100",
      }, 15),
      // All-time popular (fill gaps)
      fetchRawgList("games", {
        ordering: "-rating",
        metacritic: "80,100",
      }, 15),
    ]);

  // Deduplicate by RAWG slug
  const seen = new Set<string>();
  const allGames: { name: string; source: string }[] = [];

  for (const [list, source] of [
    [trending, "trending"],
    [newReleases, "new-release"],
    [upcomingGames, "upcoming"],
    [topThisYear, "top-this-year"],
    [popularAllTime, "popular-all-time"],
  ] as [RawgListResult[], string][]) {
    for (const game of list) {
      if (!seen.has(game.slug)) {
        seen.add(game.slug);
        allGames.push({ name: game.name, source });
      }
    }
  }

  // Ingest each game (existing ones are auto-skipped)
  let newCount = 0;
  let existedCount = 0;
  let failedCount = 0;
  const newGames: string[] = [];
  const errors: string[] = [];

  for (const { name } of allGames) {
    try {
      const result = await ingestGame({ query: name });
      if (result.success) {
        if (result.alreadyExisted) {
          existedCount++;
        } else {
          newCount++;
          newGames.push(name);
        }
      } else {
        failedCount++;
        errors.push(`${name}: ${result.message}`);
      }
    } catch (err) {
      failedCount++;
      errors.push(`${name}: ${(err as Error).message}`);
    }

    // Rate limit: 200ms between each call
    await new Promise((r) => setTimeout(r, 200));
  }

  return jsonOk({
    discovered: allGames.length,
    newGamesIngested: newCount,
    alreadyExisted: existedCount,
    failed: failedCount,
    newGames,
    errors: errors.slice(0, 10), // limit error output
    timestamp: now.toISOString(),
  });
}
