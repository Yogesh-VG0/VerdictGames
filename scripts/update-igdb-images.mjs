#!/usr/bin/env node

/**
 * VERDICT.GAMES — Update Game Images from IGDB
 *
 * Fetches cover images, screenshots, and header images from IGDB for all games
 * that currently have RAWG images. Only updates image fields — doesn't touch
 * scores, descriptions, or other metadata.
 *
 * Rate limit: 4 req/sec for IGDB. Script uses 300ms delay between games.
 *
 * Usage:
 *   node scripts/update-igdb-images.mjs
 *   node scripts/update-igdb-images.mjs --limit=50
 *   node scripts/update-igdb-images.mjs --dry-run
 */

import postgres from "postgres";

// Load .env
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
} catch { /* Heroku uses Config Vars */ }

const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false } });

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
  console.error("❌ Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET");
  process.exit(1);
}

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find(a => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1]) : 9999;

// ── IGDB Auth ──
let token = null;

async function getToken() {
  if (token) return token;
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  const data = await res.json();
  token = data.access_token;
  return token;
}

async function igdbQuery(endpoint, body) {
  const accessToken = await getToken();
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": TWITCH_CLIENT_ID,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "text/plain",
    },
    body,
  });
  if (!res.ok) {
    console.error(`  IGDB ${endpoint} failed: ${res.status}`);
    return null;
  }
  return res.json();
}

function igdbImageUrl(imageId, size = "cover_big") {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

function escapeQuotes(str) {
  return str.replace(/"/g, '\\"');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Main ──

console.log("═══════════════════════════════════════════");
console.log("  VERDICT.GAMES — Update IGDB Images");
console.log(`  ${new Date().toISOString()}`);
console.log(`  Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
console.log(`  Limit: ${limit}`);
console.log("═══════════════════════════════════════════\n");

// Fetch all games that have RAWG images (or no IGDB images)
const games = await sql`
  SELECT id, title, slug, release_date, cover_image, header_image
  FROM games
  WHERE cover_image IS NOT NULL AND cover_image != ''
  ORDER BY score DESC NULLS LAST
  LIMIT ${limit}
`;

console.log(`Found ${games.length} games to process\n`);

let updated = 0;
let skipped = 0;
let noMatch = 0;
let errors = 0;

for (let i = 0; i < games.length; i++) {
  const game = games[i];
  const progress = `[${i + 1}/${games.length}]`;

  // Extract release year for disambiguation
  const releaseYear = game.release_date
    ? new Date(game.release_date).getFullYear()
    : null;

  // Skip if already has IGDB images
  if (game.cover_image?.includes("images.igdb.com")) {
    skipped++;
    continue;
  }

  // Search IGDB
  const yearFilter = releaseYear
    ? `& first_release_date != null`
    : "";
  const searchResults = await igdbQuery(
    "games",
    `search "${escapeQuotes(game.title)}";
     fields name, slug, first_release_date, cover.image_id, screenshots.image_id;
     where game_type = 0 ${yearFilter};
     limit 10;`
  );

  if (!searchResults || searchResults.length === 0) {
    console.log(`${progress} ⚠ No IGDB match: ${game.title}`);
    noMatch++;
    await delay(250);
    continue;
  }

  // Find best match using name + release year
  const normalizedTitle = game.title.toLowerCase().trim();
  let bestMatch = searchResults[0];
  let bestScore = -Infinity;

  for (const result of searchResults) {
    let score = 0;
    const resultName = result.name.toLowerCase().trim();

    if (resultName === normalizedTitle) score += 100;
    else if (resultName.includes(normalizedTitle) || normalizedTitle.includes(resultName)) score += 50;

    if (releaseYear && result.first_release_date) {
      const resultYear = new Date(result.first_release_date * 1000).getFullYear();
      if (resultYear === releaseYear) score += 80;
      else if (Math.abs(resultYear - releaseYear) === 1) score += 30;
      else if (Math.abs(resultYear - releaseYear) > 5) score -= 40;
    }

    if (result.cover?.image_id) score += 10;
    if (result.screenshots?.length) score += 5;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = result;
    }
  }

  // Verify the match is reasonable (name should at least partially match)
  const matchName = bestMatch.name.toLowerCase().trim();
  if (!matchName.includes(normalizedTitle) && !normalizedTitle.includes(matchName)) {
    // Check word overlap
    const gameWords = normalizedTitle.split(/\s+/).filter(w => w.length > 2);
    const matchWords = matchName.split(/\s+/).filter(w => w.length > 2);
    const overlap = gameWords.filter(w => matchWords.includes(w)).length;
    if (overlap < Math.min(gameWords.length, matchWords.length) * 0.5) {
      console.log(`${progress} ⚠ Weak match skipped: "${game.title}" → "${bestMatch.name}"`);
      noMatch++;
      await delay(250);
      continue;
    }
  }

  // Fetch full game data for screenshots
  const fullData = await igdbQuery(
    "games",
    `where id = ${bestMatch.id};
     fields name, cover.image_id, screenshots.image_id;
     limit 1;`
  );

  const fullGame = fullData?.[0] ?? bestMatch;

  // Build image updates
  const updates = {};

  if (fullGame.cover?.image_id) {
    updates.cover_image = igdbImageUrl(fullGame.cover.image_id, "cover_big_2x");
  }

  const screenshots = (fullGame.screenshots ?? []).slice(0, 6);
  if (screenshots.length > 0) {
    updates.screenshots = screenshots.map(s => igdbImageUrl(s.image_id, "screenshot_big"));
    updates.header_image = igdbImageUrl(screenshots[0].image_id, "screenshot_big");
  }

  if (Object.keys(updates).length === 0) {
    console.log(`${progress} ⚠ No images from IGDB: ${game.title}`);
    noMatch++;
    await delay(250);
    continue;
  }

  if (dryRun) {
    console.log(`${progress} 🔍 Would update: ${game.title} → ${Object.keys(updates).join(", ")}`);
    updated++;
  } else {
    try {
      updates.updated_at = new Date().toISOString();

      const setClauses = [];
      const values = [];
      let paramIdx = 2; // $1 is the game id

      for (const [key, value] of Object.entries(updates)) {
        if (key === "screenshots") {
          setClauses.push(`${key} = $${paramIdx}::text[]`);
        } else {
          setClauses.push(`${key} = $${paramIdx}`);
        }
        values.push(value);
        paramIdx++;
      }

      await sql.unsafe(
        `UPDATE games SET ${setClauses.join(", ")} WHERE id = $1`,
        [game.id, ...values]
      );

      console.log(`${progress} ✓ ${game.title} → ${Object.keys(updates).filter(k => k !== "updated_at").join(", ")}`);
      updated++;
    } catch (err) {
      console.log(`${progress} ✗ Error: ${game.title} — ${err.message}`);
      errors++;
    }
  }

  // Rate limit: ~3 requests per game (search + full fetch + update), 4 req/sec limit
  await delay(300);
}

console.log("\n═══════════════════════════════════════════");
console.log(`  Updated: ${updated}`);
console.log(`  Skipped (already IGDB): ${skipped}`);
console.log(`  No match: ${noMatch}`);
console.log(`  Errors: ${errors}`);
console.log(`  Total: ${games.length}`);
console.log("  ✅ Done!");
console.log("═══════════════════════════════════════════\n");

await sql.end();
