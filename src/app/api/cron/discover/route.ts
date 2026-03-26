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

export const maxDuration = 300; // 5 min max for Vercel

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

  // Always fetch platform-specific games (PS5, Xbox Series, Switch, PS4, Android)
  const platformIds = [
    { id: "187", name: "PS5" },
    { id: "186", name: "Xbox Series" },
    { id: "7", name: "Switch" },
    { id: "18", name: "PS4" },
    { id: "21", name: "Android" },
  ];
  for (const plat of platformIds) {
    fetches.push(
      fetchRawgList("games", { platforms: plat.id, ordering: "-metacritic", metacritic: "60,100" }, 40)
    );
    fetches.push(
      fetchRawgList("games", { platforms: plat.id, ordering: "-rating" }, 40)
    );
    fetches.push(
      fetchRawgList("games", { platforms: plat.id, ordering: "-added", dates: recentWindow }, 20)
    );
  }

  // Always fetch by popular genres (more aggressive in standard mode now)
  const genres = ["action", "rpg", "adventure", "strategy", "shooter", "puzzle", "platformer", "racing", "sports", "simulation", "indie", "fighting"];
  for (const genre of genres) {
    fetches.push(
      fetchRawgList("games", { genres: genre, ordering: "-rating", metacritic: "65,100" }, 40)
    );
    fetches.push(
      fetchRawgList("games", { genres: genre, ordering: "-added", dates: recentWindow }, 20)
    );
  }

  // Multi-page top rated games to build a larger library
  for (let p = 1; p <= 5; p++) {
    fetches.push(
      fetchRawgList("games", { ordering: "-metacritic", metacritic: "70,100", page: String(p) }, 40)
    );
  }

  // Recent years with high ratings
  for (let y = currentYear - 5; y <= currentYear; y++) {
    fetches.push(
      fetchRawgList("games", { ordering: "-metacritic", dates: `${y}-01-01,${y}-12-31`, metacritic: "60,100" }, 40)
    );
  }

  if (deep) {
    // Go even deeper: more pages per genre + platform combo
    for (const genre of genres) {
      for (let p = 2; p <= 3; p++) {
        fetches.push(
          fetchRawgList("games", { genres: genre, ordering: "-rating", page: String(p) }, 40)
        );
      }
    }

    for (const plat of platformIds) {
      for (let p = 2; p <= 4; p++) {
        fetches.push(
          fetchRawgList("games", { platforms: plat.id, ordering: "-rating", page: String(p) }, 40)
        );
      }
    }

    // Classic years with lower thresholds
    for (let y = currentYear - 10; y <= currentYear - 6; y++) {
      fetches.push(
        fetchRawgList("games", { ordering: "-metacritic", dates: `${y}-01-01,${y}-12-31`, metacritic: "70,100" }, 40)
      );
    }

    // More pages of all-time favorites
    for (let p = 2; p <= 10; p++) {
      fetches.push(
        fetchRawgList("games", { ordering: "-metacritic", metacritic: "70,100", page: String(p) }, 40)
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

    // Rate limit: 100ms between each call
    await new Promise((r) => setTimeout(r, 100));
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
