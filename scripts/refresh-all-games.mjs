/**
 * Refresh all games in the database — re-ingest with forceRefresh=true
 * to get updated descriptions, release dates, and other data.
 *
 * Run: node scripts/refresh-all-games.mjs
 * Requires dev server running on localhost:3000
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const BASE = process.env.API_URL || "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fetching all games from database...");

  const { data: games, error } = await supabase
    .from("games")
    .select("title, slug")
    .order("title");

  if (error) {
    console.error("Failed to fetch games:", error);
    process.exit(1);
  }

  console.log(`Found ${games.length} games to refresh.\n`);

  let refreshed = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const title = game.title;
    const progress = `[${i + 1}/${games.length}]`;

    try {
      const r = await fetch(`${BASE}/api/ingest/game`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: title, forceRefresh: true }),
      });

      if (r.ok) {
        const result = await r.json();
        console.log(`${progress} ✓ ${title} (${result.status})`);
        refreshed++;
      } else {
        const err = await r.text();
        console.log(`${progress} ✗ ${title} — ${r.status}: ${err.slice(0, 100)}`);
        failed++;
        errors.push({ title, error: err.slice(0, 200) });
      }
    } catch (err) {
      console.log(`${progress} ✗ ${title} — ${err.message}`);
      failed++;
      errors.push({ title, error: err.message });
    }

    // Rate limit: 250ms between requests
    if (i < games.length - 1) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`Refresh complete!`);
  console.log(`  Refreshed: ${refreshed}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Total:     ${games.length}`);
  if (errors.length > 0) {
    console.log(`\nErrors:`);
    errors.forEach((e) => console.log(`  - ${e.title}: ${e.error}`));
  }
}

main().catch(console.error);
