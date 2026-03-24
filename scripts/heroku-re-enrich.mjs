#!/usr/bin/env node

/**
 * VERDICT.GAMES — Heroku Scheduler: Re-enrich Stale Games
 *
 * Calls the Vercel-hosted /api/cron/re-enrich endpoint to batch-refresh
 * games whose enrichment data is older than 24 hours.
 *
 * Heroku Scheduler command: node scripts/heroku-re-enrich.mjs
 *
 * Required Heroku Config Vars:
 *   CRON_SECRET (must match the one set on Vercel)
 *   SITE_URL (default: https://www.verdict.games)
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

import { startRun, finishRun, acquireLock, releaseLock } from './lib/scheduler-logger.mjs';
import { connectDb, getDbUrl } from './lib/db-connect.mjs';

const SITE_URL = process.env.SITE_URL || "https://www.verdict.games";
const CRON_SECRET = process.env.CRON_SECRET || "";
const LIMIT = process.argv.includes("--limit")
  ? process.argv[process.argv.indexOf("--limit") + 1]
  : "20";

const sql = getDbUrl() ? connectDb("re-enrich") : null;

const start = Date.now();
console.log("═══════════════════════════════════════════");
console.log("  VERDICT.GAMES — Re-enrich Stale Games");
console.log(`  Limit: ${LIMIT} games per run`);
console.log(`  ${new Date().toISOString()}`);
console.log("═══════════════════════════════════════════\n");

const params = new URLSearchParams();
if (CRON_SECRET) params.set("secret", CRON_SECRET);
params.set("limit", LIMIT);
const url = `${SITE_URL}/api/cron/re-enrich?${params}`;
let run = null;
if (sql) {
  const locked = await acquireLock(sql, 're-enrich');
  if (!locked) { await sql.end(); process.exit(0); }
  run = await startRun(sql, 're-enrich', { limit: LIMIT });
}

console.log(`🌐 Calling ${SITE_URL}/api/cron/re-enrich ...`);

try {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "VerdictGames-HerokuScheduler/1.0",
      ...(CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {}),
    },
    signal: AbortSignal.timeout(600000), // 10 min timeout
  });

  if (!res.ok) {
    console.error(`❌ API returned ${res.status}: ${res.statusText}`);
    const text = await res.text().catch(() => "");
    if (text) console.error(`   ${text.slice(0, 500)}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`\n✅ Re-enrichment complete:`);
  console.log(`   Refreshed: ${data.refreshed ?? 0}`);
  console.log(`   Failed: ${data.failed ?? 0}`);
  console.log(`   Total processed: ${data.total ?? 0}`);

  if (data.log?.length > 0) {
    console.log(`\n📋 Details:`);
    for (const entry of data.log) {
      console.log(`   ${entry}`);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n⏱ Time: ${elapsed}s`);

  if (sql) {
    await finishRun(sql, run?.id, {
      rows_scanned: data.total ?? 0,
      rows_updated: data.refreshed ?? 0,
      metadata: { elapsed, failed: data.failed ?? 0, limit: LIMIT },
    });
    await releaseLock(sql, 're-enrich');
    await sql.end();
  }
} catch (err) {
  console.error(`❌ Failed to call re-enrich endpoint:`, err.message);
  if (sql) {
    await finishRun(sql, run?.id, { error_message: err.message });
    await releaseLock(sql, 're-enrich');
    await sql.end();
  }
  process.exit(1);
}
