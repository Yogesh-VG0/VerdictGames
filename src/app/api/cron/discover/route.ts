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
  // Require CRON_SECRET for production security
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return jsonError("CRON_SECRET not configured", 503);
  }
  const provided = request.nextUrl.searchParams.get("secret");
  if (provided !== cronSecret) {
    return jsonError("Unauthorized", 401);
  }

  if (!process.env.RAWG_API_KEY) {
    return jsonError("RAWG_API_KEY not configured", 503);
  }

  // "deep" mode fetches many more games across genres, years, and platforms
  const deep = request.nextUrl.searchParams.get("deep") === "true";
  const pageParam = parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10);

  const now = new Date();
  const currentYear = now.getFullYear();
  const lastMonth = formatDateRange(30, 0);
  const upcoming = formatDateRange(0, 180);
  const recentWindow = formatDateRange(90, 0);
  const thisYear = `${currentYear}-01-01,${currentYear}-12-31`;
  const lastYear = `${currentYear - 1}-01-01,${currentYear - 1}-12-31`;

  // Fetch many lists in parallel from RAWG
  const fetches: Promise<RawgListResult[]>[] = [
    // Currently trending/popular
    fetchRawgList("games", { ordering: "-added", dates: recentWindow }, 40),
    // Recently released
    fetchRawgList("games", { ordering: "-released", dates: lastMonth }, 40),
    // Upcoming releases (6 months out)
    fetchRawgList("games", { ordering: "-added", dates: upcoming }, 40),
    // Top rated this year
    fetchRawgList("games", { ordering: "-metacritic", dates: thisYear, metacritic: "60,100" }, 40),
    // Top rated last year
    fetchRawgList("games", { ordering: "-metacritic", dates: lastYear, metacritic: "70,100" }, 40),
    // All-time popular
    fetchRawgList("games", { ordering: "-rating", metacritic: "80,100" }, 40),
    // Most played / added recently
    fetchRawgList("games", { ordering: "-added", metacritic: "1,100" }, 40),
    // Highest rated with lots of reviews
    fetchRawgList("games", { ordering: "-rating", page: String(pageParam) }, 40),
  ];

  if (deep) {
    // Fetch by specific popular genres
    const genres = ["action", "rpg", "adventure", "strategy", "shooter", "puzzle", "platformer", "racing", "sports", "simulation", "indie", "fighting"];
    for (const genre of genres) {
      fetches.push(
        fetchRawgList("games", { genres: genre, ordering: "-rating", metacritic: "70,100" }, 20)
      );
      fetches.push(
        fetchRawgList("games", { genres: genre, ordering: "-added", dates: recentWindow }, 10)
      );
    }

    // Platform-specific: PS5, Xbox Series, Switch
    const platformIds = ["187", "186", "7"]; // PS5, Xbox Series, Switch RAWG IDs
    for (const pid of platformIds) {
      fetches.push(
        fetchRawgList("games", { platforms: pid, ordering: "-metacritic", metacritic: "70,100" }, 20)
      );
    }

    // Classic years
    for (let y = currentYear - 5; y <= currentYear - 2; y++) {
      fetches.push(
        fetchRawgList("games", { ordering: "-metacritic", dates: `${y}-01-01,${y}-12-31`, metacritic: "75,100" }, 20)
      );
    }
  }

  const allLists = await Promise.all(fetches);

  // Deduplicate by RAWG slug
  const seen = new Set<string>();
  const allGames: { name: string; source: string }[] = [];

  const sourceLabels = [
    "trending", "new-release", "upcoming", "top-this-year", "top-last-year",
    "popular-all-time", "most-added", "highest-rated",
  ];

  for (let i = 0; i < allLists.length; i++) {
    const source = sourceLabels[i] ?? `batch-${i}`;
    for (const game of allLists[i]) {
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

    // Rate limit: 150ms between each call
    await new Promise((r) => setTimeout(r, 150));
  }

  return jsonOk({
    discovered: allGames.length,
    newGamesIngested: newCount,
    alreadyExisted: existedCount,
    failed: failedCount,
    newGames,
    errors: errors.slice(0, 20),
    timestamp: now.toISOString(),
    mode: deep ? "deep" : "standard",
  });
}
