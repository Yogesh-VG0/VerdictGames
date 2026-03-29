#!/usr/bin/env node
/**
 * backfill-igdb-covers.mjs
 * 
 * Comprehensive backfill script to update ALL games in the database
 * to use IGDB covers as the primary source. This ensures consistency
 * across all games regardless of how they were originally ingested.
 * 
 * IGDB covers are preferred because:
 * - Higher quality and resolution
 * - More reliable (fewer 404s than Steam)
 * - Consistent aspect ratio (3:4 portrait covers)
 * 
 * Priority order:
 *   1. IGDB cover (most reliable, high-quality)
 *   2. Keep existing RAWG cover (if IGDB unavailable)
 *   3. Steam validated cover (last resort)
 * 
 * Usage:
 *   node scripts/backfill-igdb-covers.mjs [options]
 * 
 * Options:
 *   --dry-run        Preview changes without writing to DB
 *   --limit=N        Process only N games (for testing)
 *   --force          Update even if current cover is from IGDB
 *   --steam-only     Only fix games with Steam covers
 *   --no-cover-only  Only fix games with missing covers
 * 
 * Requires env vars:
 *   DATABASE_URL or SUPABASE_DB_URL
 *   TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET (for IGDB)
 */

// Load .env for local development
try {
  const dotenv = await import("dotenv");
  dotenv.config();
} catch {
  // dotenv not installed - env vars already set
}

import postgres from "postgres";

// ══════════════════════════════════════════════════
// Configuration
// ══════════════════════════════════════════════════
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_BASE = "https://api.igdb.com/v4";

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const STEAM_ONLY = args.includes("--steam-only");
const NO_COVER_ONLY = args.includes("--no-cover-only");
const limitArg = args.find(a => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : null;

// ══════════════════════════════════════════════════
// Database Connection
// ══════════════════════════════════════════════════
function getDbUrl() {
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("Missing DATABASE_URL or SUPABASE_DB_URL");
  return url;
}

const sql = postgres(getDbUrl(), {
  ssl: { rejectUnauthorized: false },
  max: 3,
  idle_timeout: 20,
});

// ══════════════════════════════════════════════════
// IGDB API
// ══════════════════════════════════════════════════
let igdbToken = null;
let tokenExpiry = 0;

async function getIgdbToken() {
  if (igdbToken && Date.now() < tokenExpiry) return igdbToken;
  
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("❌ Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET");
    return null;
  }
  
  try {
    const res = await fetch(
      `${TWITCH_TOKEN_URL}?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      { method: "POST" }
    );
    if (!res.ok) {
      console.error("❌ Failed to get IGDB token:", res.status);
      return null;
    }
    const data = await res.json();
    igdbToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return igdbToken;
  } catch (err) {
    console.error("❌ IGDB token error:", err.message);
    return null;
  }
}

async function igdbQuery(endpoint, body) {
  const token = await getIgdbToken();
  if (!token) return null;
  
  try {
    const res = await fetch(`${IGDB_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Get IGDB game by ID with cover and screenshots
 */
async function getIgdbGameById(igdbId) {
  const data = await igdbQuery(
    "games",
    `fields name,cover.image_id,screenshots.image_id; where id = ${igdbId};`
  );
  return data?.[0] ?? null;
}

/**
 * Search IGDB for a game by title
 */
async function searchIgdb(title, releaseYear) {
  // Clean title for search
  const cleanTitle = title
    .replace(/[™®©]/g, "")
    .replace(/\s*:\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  let query = `search "${cleanTitle}"; fields name,cover.image_id,screenshots.image_id,first_release_date; limit 5;`;
  
  const data = await igdbQuery("games", query);
  if (!data?.length) return null;
  
  // Find best match
  const normalizeTitle = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const targetNorm = normalizeTitle(title);
  
  // Score each result
  const scored = data.map(game => {
    let score = 0;
    const gameNorm = normalizeTitle(game.name);
    
    // Exact match
    if (gameNorm === targetNorm) score += 100;
    // Starts with
    else if (gameNorm.startsWith(targetNorm) || targetNorm.startsWith(gameNorm)) score += 50;
    // Contains
    else if (gameNorm.includes(targetNorm) || targetNorm.includes(gameNorm)) score += 25;
    
    // Year match bonus
    if (releaseYear && game.first_release_date) {
      const gameYear = new Date(game.first_release_date * 1000).getFullYear();
      if (gameYear === releaseYear) score += 20;
      else if (Math.abs(gameYear - releaseYear) <= 1) score += 10;
    }
    
    // Has cover bonus
    if (game.cover?.image_id) score += 5;
    
    return { ...game, score };
  });
  
  // Sort by score desc
  scored.sort((a, b) => b.score - a.score);
  
  // Only return if reasonable confidence
  return scored[0]?.score >= 25 ? scored[0] : null;
}

/**
 * Build IGDB image URL from image_id
 */
function igdbImageUrl(imageId, size = "cover_big_2x") {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

// ══════════════════════════════════════════════════
// RAWG API (Fallback)
// ══════════════════════════════════════════════════
const RAWG_BASE = "https://api.rawg.io/api";
const RAWG_KEY = process.env.RAWG_API_KEY;

async function fetchRawgGame(rawgId) {
  if (!RAWG_KEY) return null;
  try {
    const res = await fetch(`${RAWG_BASE}/games/${rawgId}?key=${RAWG_KEY}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function searchRawgByTitle(title) {
  if (!RAWG_KEY) return null;
  try {
    const res = await fetch(
      `${RAWG_BASE}/games?key=${RAWG_KEY}&search=${encodeURIComponent(title)}&page_size=3&search_precise=true`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    // Find best match with background_image
    const match = data.results?.find(
      (r) => r.background_image && r.name.toLowerCase() === title.toLowerCase()
    ) || data.results?.find((r) => r.background_image);
    return match ?? null;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════
// Steam API (Last Resort Fallback)
// ══════════════════════════════════════════════════
async function fetchSteamCoverViaGetItems(steamAppId) {
  if (!steamAppId) return null;
  try {
    const inputJson = JSON.stringify({
      ids: [{ appid: parseInt(steamAppId) }],
      context: { country_code: "US" },
      data_request: { include_assets: true }
    });
    const url = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(inputJson)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.response?.store_items?.[0];
    if (!item?.assets) return null;
    
    const { asset_url_format, library_capsule_2x, header } = item.assets;
    if (!asset_url_format || !library_capsule_2x) return null;
    
    const baseUrl = "https://shared.akamai.steamstatic.com/store_item_assets";
    const coverUrl = `${baseUrl}/${asset_url_format.replace("${FILENAME}", library_capsule_2x)}`;
    const headerUrl = header ? `${baseUrl}/${asset_url_format.replace("${FILENAME}", header)}` : null;
    
    return { coverUrl, headerUrl };
  } catch {
    return null;
  }
}

async function validateAndGetSteamCover(steamAppId) {
  if (!steamAppId) return null;
  
  // Try standard CDN URL first
  const cdnUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppId}/library_600x900_2x.jpg`;
  try {
    const res = await fetch(cdnUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      return { coverUrl: cdnUrl, headerUrl: null, source: "steam-cdn" };
    }
  } catch { /* continue to fallback */ }
  
  // Fallback: Use GetItems API
  const getItemsResult = await fetchSteamCoverViaGetItems(steamAppId);
  if (getItemsResult?.coverUrl) {
    return { ...getItemsResult, source: "steam-api" };
  }
  
  return null;
}

// ══════════════════════════════════════════════════
// Media Source Utilities
// ══════════════════════════════════════════════════
const MEDIA_SOURCE_PRIORITY = { igdb: 1, rawg: 2, steam: 3, unknown: 99 };

function getMediaSourceFromUrl(url) {
  if (!url) return null;
  if (/images\.igdb\.com/.test(url)) return "igdb";
  if (/media\.rawg\.io/.test(url)) return "rawg";
  if (/steamstatic\.com|steamcdn/.test(url)) return "steam";
  return "unknown";
}

function isMediaUpgrade(existingSource, newSource) {
  const existingPriority = MEDIA_SOURCE_PRIORITY[existingSource] ?? 99;
  const newPriority = MEDIA_SOURCE_PRIORITY[newSource] ?? 99;
  return newPriority < existingPriority;
}

// ══════════════════════════════════════════════════
// Main Backfill Logic
// ══════════════════════════════════════════════════
async function main() {
  console.log("═".repeat(60));
  console.log("🎮 VERDICT GAMES — IGDB Cover Backfill");
  console.log("═".repeat(60));
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log(`Force: ${FORCE ? "Yes (update all)" : "No (skip IGDB covers)"}`);
  if (STEAM_ONLY) console.log("Filter: Steam covers only");
  if (NO_COVER_ONLY) console.log("Filter: Missing covers only");
  if (LIMIT) console.log(`Limit: ${LIMIT} games`);
  console.log("");
  
  // Test IGDB connection
  const token = await getIgdbToken();
  if (!token) {
    console.error("❌ Cannot connect to IGDB. Check your credentials.");
    process.exit(1);
  }
  console.log("✅ IGDB connection OK\n");
  
  // Build query based on filters
  let query;
  if (NO_COVER_ONLY) {
    query = sql`
      SELECT id, title, slug, cover_image, media_source, igdb_id, rawg_id, steam_app_id, release_date
      FROM games
      WHERE cover_image IS NULL OR cover_image = ''
      ORDER BY created_at DESC
      ${LIMIT ? sql`LIMIT ${LIMIT}` : sql``}
    `;
  } else if (STEAM_ONLY) {
    query = sql`
      SELECT id, title, slug, cover_image, media_source, igdb_id, rawg_id, steam_app_id, release_date
      FROM games
      WHERE cover_image LIKE '%steamstatic%' OR cover_image LIKE '%steamcdn%' OR media_source = 'steam'
      ORDER BY created_at DESC
      ${LIMIT ? sql`LIMIT ${LIMIT}` : sql``}
    `;
  } else {
    query = sql`
      SELECT id, title, slug, cover_image, media_source, igdb_id, rawg_id, steam_app_id, release_date
      FROM games
      ORDER BY created_at DESC
      ${LIMIT ? sql`LIMIT ${LIMIT}` : sql``}
    `;
  }
  
  const games = await query;
  console.log(`Found ${games.length} games to process\n`);
  
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let noIgdb = 0;
  
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const progress = `[${i + 1}/${games.length}]`;
    
    // Determine current media source
    const currentSource = game.media_source || getMediaSourceFromUrl(game.cover_image);
    
    // Skip if already IGDB and not forcing
    if (currentSource === "igdb" && !FORCE) {
      console.log(`${progress} ⏭️  ${game.title} — Already IGDB cover`);
      skipped++;
      continue;
    }
    
    console.log(`${progress} 🔍 ${game.title}`);
    
    let igdbGame = null;
    
    // Strategy 1: Use existing IGDB ID if available
    if (game.igdb_id) {
      console.log(`       📡 Fetching IGDB ID: ${game.igdb_id}`);
      igdbGame = await getIgdbGameById(game.igdb_id);
    }
    
    // Strategy 2: Search IGDB by title
    if (!igdbGame?.cover?.image_id) {
      const releaseYear = game.release_date ? new Date(game.release_date).getFullYear() : null;
      console.log(`       🔎 Searching IGDB: "${game.title}"${releaseYear ? ` (${releaseYear})` : ""}`);
      igdbGame = await searchIgdb(game.title, releaseYear);
    }
    
    // ══════════════════════════════════════════════════
    // COVER IMAGE PRIORITY: IGDB → RAWG → Steam
    // ══════════════════════════════════════════════════
    let newCoverUrl = null;
    let newMediaSource = null;
    let newIgdbId = null;
    
    // Priority 1: IGDB cover (best quality)
    if (igdbGame?.cover?.image_id) {
      newCoverUrl = igdbImageUrl(igdbGame.cover.image_id);
      newMediaSource = "igdb";
      newIgdbId = igdbGame.id;
      console.log(`       ✅ [IGDB] Found: ${igdbGame.name} (cover: ${igdbGame.cover.image_id})`);
    }
    
    // Priority 2: RAWG cover (fallback)
    if (!newCoverUrl && RAWG_KEY) {
      console.log(`       📡 [Fallback] Trying RAWG...`);
      
      // Try by RAWG ID first
      if (game.rawg_id) {
        const rawgGame = await fetchRawgGame(game.rawg_id);
        if (rawgGame?.background_image) {
          newCoverUrl = rawgGame.background_image;
          newMediaSource = "rawg";
          console.log(`       ✅ [RAWG] Found via ID: ${rawgGame.name}`);
        }
        await new Promise(r => setTimeout(r, 200));
      }
      
      // Try search by title
      if (!newCoverUrl) {
        const rawgMatch = await searchRawgByTitle(game.title);
        if (rawgMatch?.background_image) {
          newCoverUrl = rawgMatch.background_image;
          newMediaSource = "rawg";
          console.log(`       ✅ [RAWG] Found via search: ${rawgMatch.name}`);
        }
        await new Promise(r => setTimeout(r, 200));
      }
    }
    
    // Priority 3: Steam cover (last resort)
    if (!newCoverUrl && game.steam_app_id) {
      console.log(`       📡 [Last Resort] Trying Steam (appid: ${game.steam_app_id})...`);
      const steamResult = await validateAndGetSteamCover(game.steam_app_id);
      if (steamResult?.coverUrl) {
        newCoverUrl = steamResult.coverUrl;
        newMediaSource = "steam";
        console.log(`       ✅ [Steam] Found via ${steamResult.source}`);
      } else {
        console.log(`       ⚠️  Steam validation failed`);
      }
      await new Promise(r => setTimeout(r, 200));
    }
    
    // No cover found from any source
    if (!newCoverUrl) {
      console.log(`       ❌ No cover found from any source`);
      noIgdb++;
      await new Promise(r => setTimeout(r, 250));
      continue;
    }
    
    // Check if this is actually an upgrade
    if (!FORCE && !isMediaUpgrade(currentSource, newMediaSource)) {
      console.log(`       ⏭️  Current source (${currentSource}) is same or better than ${newMediaSource}`);
      skipped++;
      await new Promise(r => setTimeout(r, 250));
      continue;
    }
    
    // Build update
    const updates = {
      cover_image: newCoverUrl,
      media_source: newMediaSource,
    };
    
    // Also update igdb_id if we found it via search
    if (!game.igdb_id && newIgdbId) {
      updates.igdb_id = newIgdbId;
    }
    
    // Update screenshots if available from IGDB and current are missing
    if (igdbGame?.screenshots?.length) {
      const ssUrls = igdbGame.screenshots
        .slice(0, 6)
        .map(s => igdbImageUrl(s.image_id, "screenshot_big"));
      
      // Check if game has no screenshots
      const [currentGame] = await sql`
        SELECT screenshots FROM games WHERE id = ${game.id}
      `;
      if (!currentGame?.screenshots?.length) {
        updates.screenshots = ssUrls;
        updates.header_image = ssUrls[0];
        console.log(`       📸 Adding ${ssUrls.length} screenshots`);
      }
    }
    
    if (DRY_RUN) {
      console.log(`       🔍 DRY RUN: Would update cover to ${newCoverUrl.slice(0, 60)}...`);
      updated++;
    } else {
      try {
        await sql`
          UPDATE games SET ${sql(updates)} WHERE id = ${game.id}
        `;
        console.log(`       💾 Updated successfully`);
        updated++;
      } catch (err) {
        console.log(`       ❌ Update failed: ${err.message}`);
        failed++;
      }
    }
    
    // Rate limit IGDB requests
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log("\n" + "═".repeat(60));
  console.log("📊 BACKFILL COMPLETE");
  console.log("═".repeat(60));
  console.log(`   ✅ Updated:    ${updated}`);
  console.log(`   ⏭️  Skipped:    ${skipped} (already IGDB)`);
  console.log(`   ❌ No IGDB:    ${noIgdb}`);
  console.log(`   💥 Failed:     ${failed}`);
  console.log(`   📦 Total:      ${games.length}`);
  console.log("");
  
  if (DRY_RUN) {
    console.log("💡 This was a DRY RUN. Run without --dry-run to apply changes.");
  }
  
  await sql.end();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
