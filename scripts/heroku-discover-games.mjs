#!/usr/bin/env node

/**
 * VERDICT.GAMES — Scheduler: Discover New Games
 *
 * Fetches trending/new/popular games from RAWG and ingests each
 * directly via the local ingest pipeline (no Vercel API calls).
 *
 * Command: node scripts/heroku-discover-games.mjs
 *
 * Required environment variables:
 *   RAWG_API_KEY,
 *   DATABASE_URL or SUPABASE_DB_URL
 *   (optional) TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET for IGDB enrichment
 */

// Hosted schedulers inject environment variables.
// For local testing, load .env file.
try {
  const { readFileSync } = await import("fs");
  const env = readFileSync(".env", "utf8");
  for (const line of env.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    if (!process.env[key]) process.env[key] = t.slice(i + 1).trim();
  }
} catch {
  // .env not found; use process environment variables.
}

import { startRun, finishRun, acquireLock, releaseLock, checkMinInterval } from './lib/scheduler-logger.mjs';
import { connectDb, closeDb } from './lib/db-connect.mjs';
import { ingestGameDirect } from './lib/ingest-pipeline.mjs';
import { rawgFetchJson } from './lib/rawg-client.mjs';

const RAWG_KEY     = process.env.RAWG_API_KEY;
const DEEP         = process.argv.includes("--deep");
const JOB_NAME     = DEEP ? "discover-games-deep" : "discover-games";
const CONCURRENCY  = 2;
const DELAY_MS     = 300;

if (!RAWG_KEY) { console.error("✗ RAWG_API_KEY not set"); process.exit(1); }

const sql = connectDb("discover-games");

// ── Helpers ──
async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function rawgFetch(endpoint, params = {}, limit = 40) {
  const json = await rawgFetchJson(`/${endpoint}`, {
    params: { page_size: limit, ...params },
  });
  return json.results ?? [];
}

function formatDateRange(daysBack, daysForward) {
  const now = new Date();
  const from = new Date(now); from.setDate(from.getDate() - daysBack);
  const to = new Date(now); to.setDate(to.getDate() + daysForward);
  return `${from.toISOString().slice(0, 10)},${to.toISOString().slice(0, 10)}`;
}

async function withConcurrency(items, concurrency, fn) {
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

// ── Main ──
const start = Date.now();
console.log("═══════════════════════════════════════════");
console.log("  VERDICT.GAMES — Discover New Games (Local Pipeline)");
console.log(`  Mode: ${DEEP ? "DEEP" : "Standard"} | Concurrency: ${CONCURRENCY}`);
console.log(`  ${new Date().toISOString()}`);
console.log("═══════════════════════════════════════════\n");

// ── Locking & interval ──
let run = null;
const MIN_INTERVAL = parseFloat(process.env.DISCOVER_INTERVAL_HOURS || "5");
const shouldRun = await checkMinInterval(sql, JOB_NAME, MIN_INTERVAL);
if (!shouldRun) { console.log("⏭ Skipping — last run too recent"); await closeDb(sql, JOB_NAME); process.exit(0); }

const locked = await acquireLock(sql, 'discover-games');
if (!locked) { console.log("🔒 Another discover run is active"); await closeDb(sql, 'discover-games'); process.exit(0); }
run = await startRun(sql, JOB_NAME, { mode: DEEP ? 'deep' : 'standard' });

try {
  const now = new Date();
  const currentYear = now.getFullYear();
  const lastMonth    = formatDateRange(30, 0);
  const upcoming     = formatDateRange(0, 180);
  const recentWindow = formatDateRange(90, 0);
  const thisYear     = `${currentYear}-01-01,${currentYear}-12-31`;
  const lastYear     = `${currentYear - 1}-01-01,${currentYear - 1}-12-31`;

  // ── Step 1: Fetch game lists from RAWG (standalone process, no Vercel timeout) ──
  console.log("📡 Step 1: Fetching game lists from RAWG...\n");

  const fetches = [
    rawgFetch("games", { ordering: "-added", dates: recentWindow }, 40),
    rawgFetch("games", { ordering: "-released", dates: lastMonth }, 40),
    rawgFetch("games", { ordering: "-added", dates: upcoming }, 40),
    rawgFetch("games", { ordering: "-metacritic", dates: thisYear, metacritic: "60,100" }, 40),
    rawgFetch("games", { ordering: "-metacritic", dates: lastYear, metacritic: "70,100" }, 40),
    rawgFetch("games", { ordering: "-rating", metacritic: "80,100" }, 40),
    rawgFetch("games", { ordering: "-added", metacritic: "1,100" }, 40),
    rawgFetch("games", { ordering: "-rating" }, 40),
  ];

  // Platform-specific
  const platforms = [
    { id: "187", name: "PS5" }, { id: "186", name: "Xbox Series" },
    { id: "7", name: "Switch" }, { id: "18", name: "PS4" }, { id: "21", name: "Android" },
  ];
  for (const plat of platforms) {
    fetches.push(rawgFetch("games", { platforms: plat.id, ordering: "-metacritic", metacritic: "60,100" }, 40));
    fetches.push(rawgFetch("games", { platforms: plat.id, ordering: "-rating" }, 40));
    fetches.push(rawgFetch("games", { platforms: plat.id, ordering: "-added", dates: recentWindow }, 20));
  }

  // Genre-specific
  const genres = ["action", "rpg", "adventure", "strategy", "shooter", "puzzle", "platformer", "racing", "sports", "simulation", "indie", "fighting"];
  for (const genre of genres) {
    fetches.push(rawgFetch("games", { genres: genre, ordering: "-rating", metacritic: "65,100" }, 40));
    fetches.push(rawgFetch("games", { genres: genre, ordering: "-added", dates: recentWindow }, 20));
  }

  // Multi-page top rated
  for (let p = 1; p <= 5; p++) {
    fetches.push(rawgFetch("games", { ordering: "-metacritic", metacritic: "70,100", page: String(p) }, 40));
  }

  // Recent years
  for (let y = currentYear - 5; y <= currentYear; y++) {
    fetches.push(rawgFetch("games", { ordering: "-metacritic", dates: `${y}-01-01,${y}-12-31`, metacritic: "60,100" }, 40));
  }

  if (DEEP) {
    for (const genre of genres) {
      for (let p = 2; p <= 3; p++) {
        fetches.push(rawgFetch("games", { genres: genre, ordering: "-rating", page: String(p) }, 40));
      }
    }
    for (const plat of platforms) {
      for (let p = 2; p <= 4; p++) {
        fetches.push(rawgFetch("games", { platforms: plat.id, ordering: "-rating", page: String(p) }, 40));
      }
    }
    for (let y = currentYear - 10; y <= currentYear - 6; y++) {
      fetches.push(rawgFetch("games", { ordering: "-metacritic", dates: `${y}-01-01,${y}-12-31`, metacritic: "70,100" }, 40));
    }
    for (let p = 2; p <= 10; p++) {
      fetches.push(rawgFetch("games", { ordering: "-metacritic", metacritic: "70,100", page: String(p) }, 40));
    }
  }

  const fetchResults = await Promise.allSettled(fetches);
  const allLists = fetchResults
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  const failedFetches = fetchResults.length - allLists.length;
  const failureMessages = fetchResults
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message ?? String(result.reason));
  const minimumSuccessfulFetches = Math.ceil(fetches.length * 0.75);
  if (allLists.length < minimumSuccessfulFetches) {
    const firstFailure = failureMessages[0] ? ` First error: ${failureMessages[0]}` : "";
    throw new Error(`RAWG discovery failed ${failedFetches}/${fetches.length} list requests.${firstFailure}`);
  }
  if (failedFetches > 0) {
    console.warn(`  ⚠ Continuing after ${failedFetches}/${fetches.length} RAWG list requests failed`);
    for (const message of [...new Set(failureMessages)].slice(0, 3)) {
      console.warn(`    - ${message}`);
    }
  }

  // Deduplicate by slug
  const seen = new Set();
  const rawGames = [];
  for (const list of allLists) {
    for (const game of list) {
      if (!seen.has(game.slug)) {
        seen.add(game.slug);
        rawGames.push(game);
      }
    }
  }

  console.log(`  Found ${rawGames.length} unique games from ${fetches.length} RAWG queries`);

  // ── Quality gates: filter out junk before ingesting ──
  const DLC_PATTERNS = [
    /:\s*(episode|part|chapter|act)\s+\w+$/i,
    /\b(dlc|expansion|season pass|starter pack|upgrade|bundle)\b/i,
    /\s-\s+(the\s+)?\w+\s+(dlc|pack|edition)$/i,
  ];
  const ADULT_TAGS = new Set(["sexual content","nsfw","hentai","adult","erotic","nudity"]);
  const JUNK_TAGS = new Set(["mod","mods","fan-made","fan game"]);
  const MIN_RATING = 2.5;       // RAWG rating 1-5
  const MIN_RATINGS_COUNT = 5;  // at least 5 ratings on RAWG

  function isDLC(game) {
    const name = game.name || "";
    // Check name patterns
    if (DLC_PATTERNS.some(p => p.test(name))) return true;
    // RAWG marks DLC/add-ons with added_by_status.toplay being very low and no metacritic
    // Also check if parent game exists (slug contains base game slug)
    return false;
  }

  function hasAdultOrJunkTags(game) {
    const tags = (game.tags ?? []).map(t => (t.name || t.slug || "").toLowerCase());
    return tags.some(t => ADULT_TAGS.has(t) || JUNK_TAGS.has(t));
  }

  const allGames = rawGames.filter(game => {
    // Skip games with very low/no ratings (obscure junk)
    if ((game.ratings_count ?? 0) < MIN_RATINGS_COUNT && !game.metacritic) return false;
    // Skip very low rated games
    if (game.rating && game.rating < MIN_RATING && (game.ratings_count ?? 0) > 20) return false;
    // Skip DLC/expansions
    if (isDLC(game)) return false;
    // Skip adult/junk content
    if (hasAdultOrJunkTags(game)) return false;
    return true;
  });

  const filtered = rawGames.length - allGames.length;
  console.log(`  After quality filtering: ${allGames.length} games (${filtered} filtered out)\n`);

  // ── Step 2: Ingest each game via local pipeline (direct DB) ──
  console.log("🔄 Step 2: Ingesting games via local pipeline...\n");

  let newCount = 0, existedCount = 0, failedCount = 0;
  const newGames = [];
  const errors = [];

  await withConcurrency(allGames, CONCURRENCY, async (game) => {
    try {
      const result = await ingestGameDirect(sql, game.name, { expectedSlug: game.slug });
      if (result.alreadyExisted) {
        existedCount++;
      } else if (result.success) {
        newCount++;
        newGames.push(game.name);
        console.log(`  ✓ [${newCount}] ${game.name}`);
      } else {
        failedCount++;
        errors.push(`${game.name}: ${result.message}`);
      }
    } catch (e) {
      failedCount++;
      errors.push(`${game.name}: ${e.message}`);
    }
    await sleep(DELAY_MS);
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (allGames.length > 0 && newCount + existedCount === 0 && failedCount > 0) {
    throw new Error(`All ${failedCount} discovered game ingestions failed`);
  }

  console.log(`\n✅ Discovery complete:`);
  console.log(`   Discovered: ${allGames.length}`);
  console.log(`   New ingested: ${newCount}`);
  console.log(`   Already existed: ${existedCount}`);
  console.log(`   Failed: ${failedCount}`);
  console.log(`   Time: ${elapsed}s`);

  if (newGames.length > 0) {
    console.log(`\n🆕 New games:`);
    for (const name of newGames.slice(0, 30)) console.log(`   + ${name}`);
    if (newGames.length > 30) console.log(`   ... and ${newGames.length - 30} more`);
  }

  if (errors.length > 0) {
    console.log(`\n⚠ Errors (first 10):`);
    for (const err of errors.slice(0, 10)) console.log(`   - ${err}`);
  }

  await finishRun(sql, run.id, {
    rows_scanned: allGames.length,
    rows_created: newCount,
    rows_skipped: existedCount,
    metadata: { elapsed, failed: failedCount, deep: DEEP, queries: fetches.length },
  });
} catch (err) {
  console.error(`❌ Discovery failed:`, err.message);
  if (run) await finishRun(sql, run.id, { error_message: err.message });
  await releaseLock(sql, 'discover-games');
  await closeDb(sql, 'discover-games');
  process.exit(1);
}

await releaseLock(sql, 'discover-games');
await closeDb(sql, 'discover-games');
