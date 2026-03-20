#!/usr/bin/env node

/**
 * VERDICT.GAMES — Game Backfill Pipeline
 *
 * Fetches games from RAWG API by year range and ingests any that are
 * missing from the Supabase DB. Uses the existing /api/ingest/game
 * endpoint for enrichment so all data pipelines stay consistent.
 *
 * Usage:
 *   node scripts/backfill-games.mjs [--year-from=2018] [--year-to=2026] [--limit=200] [--dry-run]
 *
 * Examples:
 *   node scripts/backfill-games.mjs --year-from=2024 --year-to=2026
 *   node scripts/backfill-games.mjs --year-from=2018 --year-to=2023 --limit=500
 *   node scripts/backfill-games.mjs --dry-run
 *
 * Required env:
 *   DATABASE_URL, RAWG_API_KEY, CRON_SECRET, NEXT_PUBLIC_SITE_URL or API_URL
 */

import postgres from "postgres";

// ── Load .env for local dev ──
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

const YEAR_FROM = parseInt(args["year-from"] ?? "2022");
const YEAR_TO = parseInt(args["year-to"] ?? new Date().getFullYear());
const LIMIT = parseInt(args["limit"] ?? "300");
const DRY_RUN = args["dry-run"] === true;
const PAGE_SIZE = 40;
const RAWG_BASE = "https://api.rawg.io/api";
const RAWG_KEY = process.env.RAWG_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Min score threshold to avoid ingesting junk games
const MIN_RAWG_RATING = 3.0; // out of 5
const MIN_RATINGS_COUNT = 20;

if (!RAWG_KEY) {
  console.error("✗ RAWG_API_KEY not set");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false } });

function slugify(str) {
  return str.toLowerCase()
    .replace(/['']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function rawgFetch(path) {
  const url = `${RAWG_BASE}${path}&key=${RAWG_KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`RAWG ${res.status}: ${path}`);
  return res.json();
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ──

console.log("═══════════════════════════════════════════");
console.log("  VERDICT.GAMES — Game Backfill Pipeline");
console.log(`  Years: ${YEAR_FROM}–${YEAR_TO} | Limit: ${LIMIT}${DRY_RUN ? " | DRY RUN" : ""}`);
console.log(`  ${new Date().toISOString()}`);
console.log("═══════════════════════════════════════════\n");

// Start ingest_run record
let runId = null;
if (!DRY_RUN) {
  try {
    const [run] = await sql`
      INSERT INTO ingest_runs (run_type, status, metadata)
      VALUES ('backfill', 'running', ${JSON.stringify({ year_from: YEAR_FROM, year_to: YEAR_TO, limit: LIMIT })})
      RETURNING id
    `;
    runId = run?.id;
    console.log(`📝 Ingest run: ${runId}\n`);
  } catch (e) {
    console.log(`⚠ Could not create ingest_run record: ${e.message}`);
  }
}

// Get all existing slugs and titles from DB for deduplication
console.log("📦 Loading existing games from DB...");
const existingRows = await sql`SELECT slug, title, steam_app_id FROM games`;
const existingSlugs = new Set(existingRows.map((r) => r.slug));
const existingTitlesNorm = new Set(
  existingRows.map((r) => r.title.toLowerCase().replace(/[^a-z0-9]/g, ""))
);
console.log(`  ${existingRows.length} games already in DB\n`);

let fetched = 0;
let ingested = 0;
let skipped = 0;
let errors = 0;
const errorDetails = [];

// Fetch games by year range from RAWG, sorted by rating desc
for (let year = YEAR_TO; year >= YEAR_FROM; year--) {
  if (fetched >= LIMIT) break;

  const dateFrom = `${year}-01-01`;
  const dateTo = year === new Date().getFullYear()
    ? new Date().toISOString().slice(0, 10)
    : `${year}-12-31`;

  console.log(`\n🗓  ${year}: fetching from RAWG...`);

  let page = 1;
  let totalFromYear = 0;

  while (fetched < LIMIT) {
    let data;
    try {
      data = await rawgFetch(
        `/games?dates=${dateFrom},${dateTo}&ordering=-rating&page=${page}&page_size=${PAGE_SIZE}&metacritic=60,100&exclude_additions=true`
      );
    } catch (e) {
      console.log(`  ✗ RAWG fetch failed for ${year} page ${page}: ${e.message}`);
      break;
    }

    const games = data?.results ?? [];
    if (games.length === 0) break;

    for (const rawgGame of games) {
      if (fetched >= LIMIT) break;

      // Quality gate
      if ((rawgGame.rating ?? 0) < MIN_RAWG_RATING) continue;
      if ((rawgGame.ratings_count ?? 0) < MIN_RATINGS_COUNT) continue;
      if (!rawgGame.name) continue;

      const gameSlug = slugify(rawgGame.name);
      const titleNorm = rawgGame.name.toLowerCase().replace(/[^a-z0-9]/g, "");

      // Skip if already in DB
      if (existingSlugs.has(gameSlug) || existingTitlesNorm.has(titleNorm)) {
        skipped++;
        continue;
      }

      fetched++;
      totalFromYear++;

      if (DRY_RUN) {
        console.log(`  [DRY] Would ingest: ${rawgGame.name} (${year}, rating: ${rawgGame.rating})`);
        continue;
      }

      // Call ingest endpoint
      try {
        const res = await fetch(`${API_URL}/api/ingest/game`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${CRON_SECRET}`,
          },
          body: JSON.stringify({ query: rawgGame.name }),
          signal: AbortSignal.timeout(30000),
        });

        if (res.ok) {
          ingested++;
          existingSlugs.add(gameSlug);
          existingTitlesNorm.add(titleNorm);
          console.log(`  ✓ [${fetched}/${LIMIT}] ${rawgGame.name} (${year})`);
        } else {
          const text = await res.text().catch(() => "");
          console.log(`  ✗ Failed: ${rawgGame.name} — ${res.status} ${text.slice(0, 80)}`);
          errors++;
          errorDetails.push({ title: rawgGame.name, error: `${res.status}` });
        }
      } catch (e) {
        console.log(`  ✗ Error: ${rawgGame.name} — ${e.message}`);
        errors++;
        errorDetails.push({ title: rawgGame.name, error: e.message });
      }

      // Rate limit: 800ms between ingests
      await sleep(800);
    }

    console.log(`  Page ${page}: processed ${games.length} RAWG results (${totalFromYear} new this year)`);

    if (!data.next) break;
    page++;
    await sleep(300);
  }

  console.log(`  Year ${year} done: ${totalFromYear} new games queued`);
}

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
