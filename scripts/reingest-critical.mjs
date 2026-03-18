#!/usr/bin/env node

/**
 * Re-ingest games with known data issues (TRIX wrong Wikipedia, LoL pricing, etc.)
 * Run: node scripts/reingest-critical.mjs
 * Requires: dev server on localhost:3000, CRON_SECRET in .env
 */

import "dotenv/config";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;

const CRITICAL_GAMES = [
  "TRIX",                    // Wrong Wikipedia (OS instead of game)
  "League of Legends",       // Wrong pricing (F2P shown as paid)
  "Counter-Strike 2",        // Ensure canonical (dedup with CS:GO)
];

if (!CRON_SECRET) {
  console.error("CRON_SECRET required. Add to .env");
  process.exit(1);
}

console.log(`Re-ingesting ${CRITICAL_GAMES.length} games with data fixes...\n`);

let success = 0;
let failed = 0;

for (const query of CRITICAL_GAMES) {
  try {
    const r = await fetch(`${BASE}/api/ingest/game`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({ query, forceRefresh: true }),
    });
    const j = await r.json();
    if (j.success && j.data?.success) {
      console.log("✓", query.padEnd(28), j.data.message?.slice(0, 60) ?? "OK");
      success++;
    } else {
      console.log("✗", query.padEnd(28), j.error || j.data?.message || r.status);
      failed++;
    }
  } catch (e) {
    console.log("✗", query.padEnd(28), e.message);
    failed++;
  }
  await new Promise((r) => setTimeout(r, 1500));
}

console.log(`\nDone! ${success} succeeded, ${failed} failed.`);
