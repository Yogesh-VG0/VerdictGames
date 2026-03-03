#!/usr/bin/env node

/**
 * VERDICT.GAMES — Heroku Scheduler: Discover New Games
 *
 * Runs via Heroku Scheduler daily to discover and ingest new games.
 * Calls the Vercel-hosted /api/cron/discover endpoint since the
 * ingestion pipeline uses Next.js server-side code.
 *
 * Heroku Scheduler command: node scripts/heroku-discover-games.mjs
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

const SITE_URL = process.env.SITE_URL || "https://www.verdict.games";
const CRON_SECRET = process.env.CRON_SECRET || "";

const start = Date.now();
console.log("═══════════════════════════════════════════");
console.log("  VERDICT.GAMES — Discover New Games");
console.log(`  ${new Date().toISOString()}`);
console.log("═══════════════════════════════════════════\n");

const url = `${SITE_URL}/api/cron/discover${CRON_SECRET ? `?secret=${CRON_SECRET}` : ""}`;
console.log(`🌐 Calling ${SITE_URL}/api/cron/discover ...`);

try {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "VerdictGames-HerokuScheduler/1.0",
      ...(CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {}),
    },
    signal: AbortSignal.timeout(120000), // 2 min timeout — discovery can be slow
  });

  if (!res.ok) {
    console.error(`❌ API returned ${res.status}: ${res.statusText}`);
    const text = await res.text().catch(() => "");
    if (text) console.error(`   ${text.slice(0, 500)}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`\n✅ Discovery complete:`);
  console.log(`   Discovered: ${data.discovered ?? 0} games`);
  console.log(`   New ingested: ${data.newGamesIngested ?? 0}`);
  console.log(`   Already existed: ${data.alreadyExisted ?? 0}`);
  console.log(`   Failed: ${data.failed ?? 0}`);

  if (data.newGames?.length > 0) {
    console.log(`\n🆕 New games:`);
    for (const name of data.newGames) {
      console.log(`   + ${name}`);
    }
  }

  if (data.errors?.length > 0) {
    console.log(`\n⚠ Errors:`);
    for (const err of data.errors.slice(0, 5)) {
      console.log(`   - ${err}`);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n⏱ Time: ${elapsed}s`);
} catch (err) {
  console.error(`❌ Failed to call discover endpoint:`, err.message);
  process.exit(1);
}
