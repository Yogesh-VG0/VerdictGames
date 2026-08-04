#!/usr/bin/env node

/**
 * VERDICT.GAMES — Scheduler: Re-enrich Stale Games
 *
 * Finds games whose enrichment data is older than 24 hours and
 * re-ingests them using the local pipeline (no Vercel API calls).
 *
 * Command: node scripts/heroku-re-enrich.mjs
 *
 * Required environment variables:
 *   DATABASE_URL or SUPABASE_DB_URL
 *   RAWG_API_KEY
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
import { reEnrichBatch } from './lib/ingest-pipeline.mjs';

const LIMIT = process.argv.includes("--limit")
  ? parseInt(process.argv[process.argv.indexOf("--limit") + 1])
  : 20;

const sql = connectDb("re-enrich");

const start = Date.now();
console.log("═══════════════════════════════════════════");
console.log("  VERDICT.GAMES — Re-enrich Stale Games (Local Pipeline)");
console.log(`  Limit: ${LIMIT} games per run`);
console.log(`  ${new Date().toISOString()}`);
console.log("═══════════════════════════════════════════\n");

// Skip if last successful run was less than 5 hours ago
const MIN_INTERVAL_HOURS = parseFloat(process.env.RE_ENRICH_INTERVAL_HOURS || "5");
const shouldRun = await checkMinInterval(sql, 're-enrich', MIN_INTERVAL_HOURS);
if (!shouldRun) { await closeDb(sql, 're-enrich'); process.exit(0); }

const locked = await acquireLock(sql, 're-enrich');
if (!locked) { await closeDb(sql, 're-enrich'); process.exit(0); }
const run = await startRun(sql, 're-enrich', { limit: LIMIT });

try {
  const data = await reEnrichBatch(sql, { limit: LIMIT });

  if (data.log?.length > 0) {
    console.log(`\n📋 Details:`);
    for (const entry of data.log) {
      console.log(`   ${entry}`);
    }
  }

  if (data.total > 0 && data.failed === data.total) {
    throw new Error(`All ${data.total} re-enrichments failed`);
  }

  console.log(`\n✅ Re-enrichment complete:`);
  console.log(`   Refreshed: ${data.refreshed}`);
  console.log(`   Failed: ${data.failed}`);
  console.log(`   Total processed: ${data.total}`);
  if (data.fastPathCount) console.log(`   Fast-path (recent): ${data.fastPathCount}`);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n⏱ Time: ${elapsed}s`);

  await finishRun(sql, run.id, {
    rows_scanned: data.total,
    rows_updated: data.refreshed,
    metadata: { elapsed, failed: data.failed, limit: LIMIT },
  });
} catch (err) {
  console.error(`❌ Re-enrichment failed:`, err.message);
  await finishRun(sql, run.id, { error_message: err.message });
  await releaseLock(sql, 're-enrich');
  await closeDb(sql, 're-enrich');
  process.exit(1);
}

await releaseLock(sql, 're-enrich');
await closeDb(sql, 're-enrich');
