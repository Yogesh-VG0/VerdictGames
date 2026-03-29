#!/usr/bin/env node
/**
 * cleanup-public-safety.mjs
 *
 * One-time DB cleanup script for Verdict Games.
 * Scans for and flags/quarantines:
 *   1. Adult/NSFW games (based on tags)
 *   2. Games with broken Steam cover URLs
 *
 * Usage:
 *   node scripts/cleanup-public-safety.mjs --scan          # Report only
 *   node scripts/cleanup-public-safety.mjs --flag-adult    # Set is_adult=true on NSFW games
 *   node scripts/cleanup-public-safety.mjs --fix-covers    # Repair broken Steam covers
 *   node scripts/cleanup-public-safety.mjs --all           # Do everything
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   Optional: RAWG_API_KEY, IGDB_CLIENT_ID, IGDB_CLIENT_SECRET
 */

import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RAWG_BASE = "https://api.rawg.io/api";
const RAWG_KEY = process.env.RAWG_API_KEY;

/* ─── Adult/NSFW tag detection ─── */

const ADULT_TAGS = new Set([
  "sexual content",
  "nsfw",
  "hentai",
  "adult",
  "erotic",
  "nudity",
  "mature-content",
  "sex",
  "porn",
  "mature",
  "adult only",
  "18+",
]);

function hasAdultTags(tags, genres) {
  const allTags = [
    ...(tags ?? []).map((t) => t.toLowerCase().trim()),
    ...(genres ?? []).map((g) => g.toLowerCase().trim()),
  ];

  for (const tag of allTags) {
    if (ADULT_TAGS.has(tag)) return true;
    for (const adultTag of ADULT_TAGS) {
      if (tag.includes(adultTag)) return true;
    }
  }
  return false;
}

/* ─── Steam cover validation ─── */

async function validateSteamCover(url) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

/* ─── RAWG fallback ─── */

async function fetchRawgGame(rawgId) {
  const res = await fetch(`${RAWG_BASE}/games/${rawgId}?key=${RAWG_KEY}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`RAWG ${res.status} for game ${rawgId}`);
  return res.json();
}

/* ─── Scan functions ─── */

async function scanAdultGames() {
  console.log("\n📋 Scanning for adult/NSFW games...\n");

  const { data: games, error } = await supabase
    .from("games")
    .select("id, title, slug, tags, genres, is_adult")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Failed to fetch games:", error.message);
    return [];
  }

  const adultGames = games.filter((g) => hasAdultTags(g.tags, g.genres));

  console.log(`Found ${adultGames.length} adult/NSFW games out of ${games.length} total\n`);

  for (const game of adultGames.slice(0, 20)) {
    const flagged = game.is_adult ? "✓" : "✗";
    console.log(`  [${flagged}] ${game.title}`);
    console.log(`      Tags: ${(game.tags ?? []).slice(0, 5).join(", ")}`);
  }

  if (adultGames.length > 20) {
    console.log(`  ... and ${adultGames.length - 20} more`);
  }

  return adultGames;
}

async function scanBrokenCovers() {
  console.log("\n📋 Scanning for broken Steam cover URLs...\n");

  const { data: games, error } = await supabase
    .from("games")
    .select("id, title, slug, cover_image, steam_app_id")
    .like("cover_image", "%library_600x900%")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Failed to fetch games:", error.message);
    return [];
  }

  console.log(`Found ${games.length} games with Steam library covers to validate\n`);

  const brokenGames = [];
  let checked = 0;

  for (const game of games) {
    const isValid = await validateSteamCover(game.cover_image);
    checked++;

    if (!isValid) {
      console.log(`  ❌ BROKEN: ${game.title}`);
      brokenGames.push(game);
    }

    // Progress indicator
    if (checked % 50 === 0) {
      console.log(`  ... checked ${checked}/${games.length}`);
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\nFound ${brokenGames.length} games with broken Steam covers\n`);
  return brokenGames;
}

/* ─── Fix functions ─── */

async function flagAdultGames(adultGames, dryRun = false) {
  console.log(`\n🔧 Flagging ${adultGames.length} adult games...\n`);

  let flagged = 0;
  let skipped = 0;

  for (const game of adultGames) {
    if (game.is_adult) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  🔍 DRY RUN: Would flag "${game.title}" as adult`);
      flagged++;
    } else {
      const { error } = await supabase
        .from("games")
        .update({ is_adult: true })
        .eq("id", game.id);

      if (error) {
        console.log(`  ❌ Failed to flag "${game.title}": ${error.message}`);
      } else {
        console.log(`  ✅ Flagged "${game.title}" as adult`);
        flagged++;
      }
    }
  }

  console.log(`\n✅ Flagged ${flagged} games, skipped ${skipped} (already flagged)`);
}

async function fixBrokenCovers(brokenGames, dryRun = false) {
  console.log(`\n🔧 Repairing ${brokenGames.length} broken covers...\n`);

  let repaired = 0;
  let failed = 0;

  for (const game of brokenGames) {
    console.log(`\n── ${game.title} (${game.slug}) ──`);

    // Get RAWG source reference
    const { data: sources } = await supabase
      .from("game_sources")
      .select("source_name, source_game_id")
      .eq("game_id", game.id);

    const rawgSource = sources?.find((s) => s.source_name === "rawg");

    let newCover = null;

    if (rawgSource && RAWG_KEY) {
      try {
        console.log(`  📡 Fetching from RAWG (id: ${rawgSource.source_game_id})...`);
        const rawgGame = await fetchRawgGame(rawgSource.source_game_id);

        if (rawgGame.background_image) {
          newCover = rawgGame.background_image;
          console.log(`  ✅ Found RAWG cover`);
        }

        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        console.log(`  ⚠️  RAWG failed: ${err.message}`);
      }
    }

    if (newCover) {
      if (dryRun) {
        console.log(`  🔍 DRY RUN: Would update cover to ${newCover.slice(0, 50)}...`);
        repaired++;
      } else {
        const { error } = await supabase
          .from("games")
          .update({
            cover_image: newCover,
            header_image: newCover,
            media_source: "rawg",
          })
          .eq("id", game.id);

        if (error) {
          console.log(`  ❌ DB update failed: ${error.message}`);
          failed++;
        } else {
          console.log(`  💾 Updated successfully`);
          repaired++;
        }
      }
    } else {
      console.log(`  ❌ No replacement image found`);
      failed++;
    }
  }

  console.log(`\n✅ Repaired ${repaired} covers, ${failed} still broken`);
}

/* ─── Main ─── */

async function main() {
  const args = process.argv.slice(2);
  const scanOnly = args.includes("--scan");
  const flagAdult = args.includes("--flag-adult") || args.includes("--all");
  const fixCovers = args.includes("--fix-covers") || args.includes("--all");
  const dryRun = args.includes("--dry-run");

  console.log("🔧 Verdict Games — Public Safety Cleanup\n");
  console.log(`   Options: scan=${scanOnly}, flag-adult=${flagAdult}, fix-covers=${fixCovers}`);
  if (dryRun) console.log("   DRY RUN — no changes will be made");

  if (!scanOnly && !flagAdult && !fixCovers) {
    console.log("\nNo action specified. Use one of:");
    console.log("  --scan          Scan and report only");
    console.log("  --flag-adult    Flag adult/NSFW games with is_adult=true");
    console.log("  --fix-covers    Repair broken Steam cover URLs");
    console.log("  --all           Do both flag-adult and fix-covers");
    console.log("  --dry-run       Preview changes without writing");
    return;
  }

  // Scan for adult games
  const adultGames = await scanAdultGames();

  // Scan for broken covers
  const brokenGames = await scanBrokenCovers();

  // Apply fixes if requested
  if (flagAdult && adultGames.length > 0) {
    await flagAdultGames(adultGames, dryRun);
  }

  if (fixCovers && brokenGames.length > 0) {
    await fixBrokenCovers(brokenGames, dryRun);
  }

  console.log("\n" + "═".repeat(50));
  console.log("🔧 Cleanup complete");
  console.log(`   Adult games found: ${adultGames.length}`);
  console.log(`   Broken covers found: ${brokenGames.length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
