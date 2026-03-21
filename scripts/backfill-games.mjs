#!/usr/bin/env node

/**
 * VERDICT.GAMES — Game Backfill Pipeline
 *
 * Fetches games from RAWG by year range and ingests missing ones.
 * Supports concurrency, configurable delay, and checkpoint/resume
 * so repeated runs don't restart from scratch.
 *
 * Usage:
 *   node scripts/backfill-games.mjs [options]
 *
 * Options:
 *   --year-from=2020     Start year (default: 2022)
 *   --year-to=2026       End year   (default: current year)
 *   --limit=60           Max games to ingest per run (default: 60)
 *   --concurrency=3      Parallel ingest workers (default: 3, max: 10)
 *   --delay-ms=100       Delay between ingest batches in ms (default: 100)
 *   --no-resume          Ignore saved checkpoint and start fresh
 *   --dry-run            Print candidates without ingesting
 *
 * Checkpoint file: .backfill-checkpoint.json (gitignored)
 * Required env: DATABASE_URL, RAWG_API_KEY, CRON_SECRET, API_URL or NEXT_PUBLIC_SITE_URL
 */

import postgres from "postgres";
import { readFileSync, writeFileSync, existsSync } from "fs";

// ── Load .env for local dev ──
try {
  const env = readFileSync(".env", "utf8");
  for (const line of env.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    if (!process.env[key]) process.env[key] = t.slice(i + 1).trim();
  }
} catch { /* Heroku Config Vars */ }

// ── Args ──
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v ?? true];
    })
);

const YEAR_FROM    = parseInt(args["year-from"]   ?? "2022");
const YEAR_TO      = parseInt(args["year-to"]     ?? String(new Date().getFullYear()));
const LIMIT        = parseInt(args["limit"]        ?? "60");
const CONCURRENCY  = Math.min(10, parseInt(args["concurrency"] ?? "3"));
const DELAY_MS     = parseInt(args["delay-ms"]     ?? "100");
const DRY_RUN      = args["dry-run"] === true;
const NO_RESUME    = args["no-resume"] === true;
const PAGE_SIZE    = 40;
const CHECKPOINT   = ".backfill-checkpoint.json";

const RAWG_BASE    = "https://api.rawg.io/api";
const RAWG_KEY     = process.env.RAWG_API_KEY;
const CRON_SECRET  = process.env.CRON_SECRET;
const API_URL      = process.env.API_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const MIN_RAWG_RATING    = 3.0;
const MIN_RATINGS_COUNT  = 20;

if (!RAWG_KEY) { console.error("✗ RAWG_API_KEY not set"); process.exit(1); }
if (!CRON_SECRET && !DRY_RUN) { console.error("✗ CRON_SECRET not set"); process.exit(1); }

const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false } });

// ── Helpers ──

function slugifyTitle(str) {
  return str.toLowerCase()
    .replace(/['']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normTitle(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function rawgFetch(path) {
  const url = `${RAWG_BASE}${path}&key=${RAWG_KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`RAWG ${res.status}: ${path}`);
  return res.json();
}

// ── Concurrency pool ──
// Runs up to `concurrency` async tasks in parallel.
async function withConcurrency(items, concurrency, fn) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// ── Checkpoint ──
function loadCheckpoint() {
  if (NO_RESUME || !existsSync(CHECKPOINT)) return null;
  try {
    return JSON.parse(readFileSync(CHECKPOINT, "utf8"));
  } catch { return null; }
}

function saveCheckpoint(state) {
  try {
    writeFileSync(CHECKPOINT, JSON.stringify(state, null, 2));
  } catch { /* non-fatal */ }
}

function clearCheckpoint() {
  try {
    if (existsSync(CHECKPOINT)) writeFileSync(CHECKPOINT, "{}");
  } catch { /* non-fatal */ }
}

// ── Main ──

console.log("═══════════════════════════════════════════");
console.log("  VERDICT.GAMES — Game Backfill Pipeline");
console.log(`  Years: ${YEAR_FROM}–${YEAR_TO} | Limit: ${LIMIT} | Concurrency: ${CONCURRENCY} | Delay: ${DELAY_MS}ms${DRY_RUN ? " | DRY RUN" : ""}`);
console.log(`  ${new Date().toISOString()}`);
console.log("═══════════════════════════════════════════\n");

// Load or init checkpoint
const checkpoint = loadCheckpoint() ?? {};
const resumeYear   = checkpoint.lastYear  ?? YEAR_TO;
const resumePage   = checkpoint.lastPage  ?? 1;
const isResuming   = !NO_RESUME && (checkpoint.lastYear || checkpoint.lastPage);
if (isResuming) console.log(`♻ Resuming from year ${resumeYear}, page ${resumePage}\n`);

// Record ingest run
let runId = null;
if (!DRY_RUN) {
  try {
    const [run] = await sql`
      INSERT INTO ingest_runs (run_type, status, metadata)
      VALUES ('backfill', 'running', ${JSON.stringify({ year_from: YEAR_FROM, year_to: YEAR_TO, limit: LIMIT, concurrency: CONCURRENCY })})
      RETURNING id
    `;
    runId = run?.id;
    console.log(`📝 Ingest run: ${runId}\n`);
  } catch (e) {
    console.log(`⚠ Could not create ingest_run record: ${e.message}`);
  }
}

// Load existing DB titles for deduplication
console.log("📦 Loading existing games from DB...");
const existingRows = await sql`SELECT slug, title FROM games`;
const existingSlugs  = new Set(existingRows.map((r) => r.slug));
const existingTitles = new Set(existingRows.map((r) => normTitle(r.title)));
console.log(`  ${existingRows.length} games already in DB\n`);

let fetched = 0;
let ingested = 0;
let skipped = 0;
let errors = 0;
const errorDetails = [];

// ── Year loop ──
for (let year = resumeYear; year >= YEAR_FROM; year--) {
  if (fetched >= LIMIT) break;

  const dateFrom = `${year}-01-01`;
  const dateTo   = year === new Date().getFullYear() ? new Date().toISOString().slice(0, 10) : `${year}-12-31`;
  const startPage = (year === resumeYear && isResuming) ? resumePage : 1;

  console.log(`\n🗓  ${year}: RAWG pages starting at p${startPage}...`);

  let page = startPage;
  let yearNew = 0;

  while (fetched < LIMIT) {
    let data;
    try {
      data = await rawgFetch(`/games?dates=${dateFrom},${dateTo}&ordering=-rating&page=${page}&page_size=${PAGE_SIZE}&metacritic=60,100&exclude_additions=true`);
    } catch (e) {
      console.log(`  ✗ RAWG error p${page}: ${e.message}`);
      break;
    }

    const rawGames = (data?.results ?? []).filter((g) => {
      if ((g.rating ?? 0) < MIN_RAWG_RATING) return false;
      if ((g.ratings_count ?? 0) < MIN_RATINGS_COUNT) return false;
      if (!g.name) return false;
      const s = slugifyTitle(g.name);
      const n = normTitle(g.name);
      if (existingSlugs.has(s) || existingTitles.has(n)) { skipped++; return false; }
      return true;
    });

    if (rawGames.length === 0) {
      if (!data.next) break;
      page++;
      saveCheckpoint({ lastYear: year, lastPage: page });
      continue;
    }

    if (DRY_RUN) {
      rawGames.slice(0, LIMIT - fetched).forEach((g) => {
        console.log(`  [DRY] ${g.name} (${year}, ★${g.rating})`);
        fetched++;
        yearNew++;
      });
    } else {
      // ── Ingest batch with concurrency ──
      const batch = rawGames.slice(0, LIMIT - fetched);

      await withConcurrency(batch, CONCURRENCY, async (rawgGame) => {
        const slug  = slugifyTitle(rawgGame.name);
        const title = normTitle(rawgGame.name);

        try {
          const res = await fetch(`${API_URL}/api/ingest/game`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${CRON_SECRET}` },
            body: JSON.stringify({ query: rawgGame.name }),
            signal: AbortSignal.timeout(45000),
          });

          if (res.ok) {
            ingested++;
            existingSlugs.add(slug);
            existingTitles.add(title);
            console.log(`  ✓ [${ingested}] ${rawgGame.name} (${year})`);
          } else {
            const text = await res.text().catch(() => "");
            console.log(`  ✗ ${rawgGame.name} — ${res.status} ${text.slice(0, 60)}`);
            errors++;
            errorDetails.push({ title: rawgGame.name, error: `${res.status}` });
          }
        } catch (e) {
          console.log(`  ✗ ${rawgGame.name} — ${e.message}`);
          errors++;
          errorDetails.push({ title: rawgGame.name, error: e.message });
        }
      });

      fetched += batch.length;
      yearNew += batch.length;
    }

    saveCheckpoint({ lastYear: year, lastPage: page });
    console.log(`  p${page}: +${rawGames.length} candidates (${yearNew} this year, ${fetched}/${LIMIT} total)`);

    if (!data.next) break;
    page++;
    await sleep(DELAY_MS);
  }

  console.log(`  Year ${year} complete: ${yearNew} games queued`);
}

// All done — clear checkpoint so next full run starts fresh
if (!DRY_RUN && fetched < LIMIT) clearCheckpoint();

// Finalize ingest run
if (!DRY_RUN && runId) {
  await sql`
    UPDATE ingest_runs SET
      status = 'completed',
      finished_at = NOW(),
      games_processed = ${fetched},
      games_created = ${ingested},
      errors = ${errors},
      error_details = ${JSON.stringify(errorDetails)}
    WHERE id = ${runId}
  `.catch(() => {});
}

console.log("\n═══════════════════════════════════════════");
console.log(`  Fetched: ${fetched} | Ingested: ${ingested} | Skipped (dup): ${skipped} | Errors: ${errors}`);
if (DRY_RUN) console.log("  ⚠ DRY RUN — no games were actually ingested");
console.log("  ✅ Done!");
console.log("═══════════════════════════════════════════\n");

await sql.end();
