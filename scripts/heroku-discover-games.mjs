#!/usr/bin/env node

/**
 * VERDICT.GAMES — Heroku Scheduler: Discover New Games
 *
 * Fetches trending/new/popular games directly from RAWG and ingests
 * each via the Vercel /api/ingest/game endpoint. Runs entirely on
 * Heroku to avoid Vercel serverless timeout issues.
 *
 * Heroku Scheduler command: node scripts/heroku-discover-games.mjs
 *
 * Required Heroku Config Vars:
 *   RAWG_API_KEY, CRON_SECRET,
 *   API_URL or NEXT_PUBLIC_SITE_URL (Vercel deployment URL)
 *   DATABASE_URL or SUPABASE_DB_URL (for scheduler logging)
 */

// On Heroku, env vars are already set via Config Vars.
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
  // .env not found — running on Heroku, env vars already set
}

import { startRun, finishRun, acquireLock, releaseLock, checkMinInterval } from './lib/scheduler-logger.mjs';
import { connectDb, getDbUrl } from './lib/db-connect.mjs';

const RAWG_BASE    = "https://api.rawg.io/api";
const RAWG_KEY     = process.env.RAWG_API_KEY;
const CRON_SECRET  = process.env.CRON_SECRET || "";
const API_URL      = process.env.API_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const DEEP         = process.argv.includes("--deep");
const CONCURRENCY  = 2;
const DELAY_MS     = 300;

if (!RAWG_KEY) { console.error("✗ RAWG_API_KEY not set"); process.exit(1); }
if (!CRON_SECRET) { console.error("✗ CRON_SECRET not set"); process.exit(1); }

const sql = getDbUrl() ? connectDb("discover-games") : null;

// ── Helpers ──
async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function rawgFetch(endpoint, params = {}, limit = 40) {
  const qs = new URLSearchParams({ key: RAWG_KEY, page_size: String(limit), ...params });
  try {
    const res = await fetch(`${RAWG_BASE}/${endpoint}?${qs}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const json = await res.json();
    return json.results ?? [];
  } catch { return []; }
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
console.log("  VERDICT.GAMES — Discover New Games");
console.log(`  Mode: ${DEEP ? "DEEP" : "Standard"} | Concurrency: ${CONCURRENCY}`);
console.log(`  API: ${API_URL}`);
console.log(`  ${new Date().toISOString()}`);
console.log("═══════════════════════════════════════════\n");

// ── Locking & interval ──
let run = null;
if (sql) {
  const MIN_INTERVAL = parseFloat(process.env.DISCOVER_INTERVAL_HOURS || "5");
  const shouldRun = await checkMinInterval(sql, 'discover-games', MIN_INTERVAL);
  if (!shouldRun) { console.log("⏭ Skipping — last run too recent"); await sql.end(); process.exit(0); }

  const locked = await acquireLock(sql, 'discover-games');
  if (!locked) { console.log("🔒 Another discover run is active"); await sql.end(); process.exit(0); }
  run = await startRun(sql, 'discover-games', { mode: DEEP ? 'deep' : 'standard' });
}

try {
  const now = new Date();
  const currentYear = now.getFullYear();
  const lastMonth    = formatDateRange(30, 0);
  const upcoming     = formatDateRange(0, 180);
  const recentWindow = formatDateRange(90, 0);
  const thisYear     = `${currentYear}-01-01,${currentYear}-12-31`;
  const lastYear     = `${currentYear - 1}-01-01,${currentYear - 1}-12-31`;

  // ── Step 1: Fetch game lists from RAWG (runs on Heroku, no Vercel timeout) ──
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

  const allLists = await Promise.all(fetches);

  // Deduplicate by slug
  const seen = new Set();
  const allGames = [];
  for (const list of allLists) {
    for (const game of list) {
      if (!seen.has(game.slug)) {
        seen.add(game.slug);
        allGames.push(game);
      }
    }
  }

  console.log(`  Found ${allGames.length} unique games from ${fetches.length} RAWG queries\n`);

  // ── Step 2: Ingest each game via Vercel /api/ingest/game ──
  console.log("🔄 Step 2: Ingesting games via API...\n");

  let newCount = 0, existedCount = 0, failedCount = 0;
  const newGames = [];
  const errors = [];

  await withConcurrency(allGames, CONCURRENCY, async (game, idx) => {
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(`${API_URL}/api/ingest/game`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${CRON_SECRET}` },
          body: JSON.stringify({ query: game.name }),
          signal: AbortSignal.timeout(45000),
        });

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const d = data.data ?? data;
          if (d.alreadyExisted) {
            existedCount++;
          } else {
            newCount++;
            newGames.push(game.name);
            console.log(`  ✓ [${newCount}] ${game.name}`);
          }
          break;
        } else if (res.status === 429 && attempt < MAX_RETRIES) {
          const backoff = 2000 * Math.pow(2, attempt);
          console.log(`  ⏳ ${game.name} — 429, retrying in ${backoff / 1000}s`);
          await sleep(backoff);
          continue;
        } else {
          const text = await res.text().catch(() => "");
          failedCount++;
          errors.push(`${game.name}: ${res.status} ${text.slice(0, 60)}`);
          break;
        }
      } catch (e) {
        if (attempt < MAX_RETRIES && (e.message?.includes('timeout') || e.message?.includes('fetch failed'))) {
          const backoff = 2000 * Math.pow(2, attempt);
          console.log(`  ⏳ ${game.name} — ${e.message}, retrying in ${backoff / 1000}s`);
          await sleep(backoff);
          continue;
        }
        failedCount++;
        errors.push(`${game.name}: ${e.message}`);
        break;
      }
    }
    await sleep(DELAY_MS);
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

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

  if (sql && run) {
    await finishRun(sql, run.id, {
      rows_scanned: allGames.length,
      rows_created: newCount,
      rows_skipped: existedCount,
      metadata: { elapsed, failed: failedCount, deep: DEEP, queries: fetches.length },
    });
  }
} catch (err) {
  console.error(`❌ Discovery failed:`, err.message);
  if (sql && run) {
    await finishRun(sql, run.id, { error_message: err.message });
  }
  if (sql) { await releaseLock(sql, 'discover-games'); await sql.end(); }
  process.exit(1);
}

if (sql) { await releaseLock(sql, 'discover-games'); await sql.end(); }
