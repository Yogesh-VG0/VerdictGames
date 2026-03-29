#!/usr/bin/env node
/**
 * repair-missing-media.mjs
 * 
 * Multi-source media repair pipeline for Verdict Games.
 * Fetches cover/header images from RAWG (primary) and IGDB (fallback)
 * for games that are missing media.
 * 
 * Usage:
 *   node scripts/repair-missing-media.mjs
 * 
 * Requires env vars:
 *   RAWG_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   Optional: IGDB_CLIENT_ID, IGDB_CLIENT_SECRET
 */

import { config } from "dotenv";
config(); // Load .env file

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RAWG_BASE = "https://api.rawg.io/api";
const RAWG_KEY = process.env.RAWG_API_KEY;

/* ─── RAWG fetchers ─── */

async function fetchRawgGame(rawgId) {
  const res = await fetch(`${RAWG_BASE}/games/${rawgId}?key=${RAWG_KEY}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`RAWG ${res.status} for game ${rawgId}`);
  return res.json();
}

async function fetchRawgScreenshots(rawgId) {
  const res = await fetch(
    `${RAWG_BASE}/games/${rawgId}/screenshots?key=${RAWG_KEY}&page_size=6`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []).map((s) => s.image).filter(Boolean);
}

/* ─── IGDB fetcher (fallback) ─── */

let igdbToken = null;

async function getIgdbToken() {
  if (igdbToken) return igdbToken;
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!res.ok) return null;
  const data = await res.json();
  igdbToken = data.access_token;
  return igdbToken;
}

async function fetchIgdbCover(igdbId) {
  const token = await getIgdbToken();
  if (!token) return null;

  const res = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": process.env.IGDB_CLIENT_ID,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: `fields cover.url,screenshots.url; where id = ${igdbId};`,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const game = data[0];
  if (!game) return null;

  const coverUrl = game.cover?.url
    ? `https:${game.cover.url.replace("t_thumb", "t_cover_big")}`
    : null;
  const screenshots = (game.screenshots ?? [])
    .map((s) => `https:${s.url.replace("t_thumb", "t_screenshot_big")}`)
    .filter(Boolean);

  return { coverUrl, screenshots };
}

/* ─── Steam cover validation ─── */

const STEAM_LIBRARY_COVER_PATTERN = /cdn\.akamai\.steamstatic\.com\/steam\/apps\/(\d+)\/library_600x900/;

async function validateSteamCover(url) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

/* ─── Main repair logic ─── */

async function main() {
  const args = process.argv.slice(2);
  const validateBroken = args.includes("--validate-broken");
  const dryRun = args.includes("--dry-run");
  
  console.log("🔧 Verdict Games — Media Repair Pipeline");
  console.log(`   Mode: ${validateBroken ? "Validate broken URLs" : "Repair missing media"}`);
  if (dryRun) console.log("   DRY RUN — no changes will be made");
  console.log("");

  let gamesToRepair;

  if (validateBroken) {
    // Find games with Steam library covers that need validation
    const { data: steamCoverGames, error: fetchErr } = await supabase
      .from("games")
      .select("id, title, slug, cover_image, header_image, screenshots, steam_app_id")
      .like("cover_image", "%library_600x900%")
      .order("created_at", { ascending: false });

    if (fetchErr) {
      console.error("❌ Failed to fetch games:", fetchErr.message);
      process.exit(1);
    }

    console.log(`Found ${steamCoverGames.length} games with Steam library covers to validate\n`);

    // Validate each Steam cover URL
    const brokenGames = [];
    for (const game of steamCoverGames) {
      const isValid = await validateSteamCover(game.cover_image);
      if (!isValid) {
        console.log(`  ❌ BROKEN: ${game.title} — ${game.cover_image.slice(0, 60)}...`);
        brokenGames.push(game);
      }
      // Rate limit
      await new Promise((r) => setTimeout(r, 100));
    }

    console.log(`\nFound ${brokenGames.length} games with broken Steam covers\n`);
    gamesToRepair = brokenGames;
  } else {
    // Original mode: find games with null/empty cover images
    const { data: missingGames, error: fetchErr } = await supabase
      .from("games")
      .select("id, title, slug, cover_image, header_image, screenshots")
      .or("cover_image.is.null,cover_image.eq.")
      .order("created_at", { ascending: false });

    if (fetchErr) {
      console.error("❌ Failed to fetch games:", fetchErr.message);
      process.exit(1);
    }

    console.log(`Found ${missingGames.length} games missing cover images\n`);
    gamesToRepair = missingGames;
  }

  if (gamesToRepair.length === 0) {
    console.log("✅ No games need repair.");
    return;
  }

  // 2. For each game, look up source IDs and repair
  let repaired = 0;
  let failed = 0;

  for (const game of gamesToRepair) {
    console.log(`\n── ${game.title} (${game.slug}) ──`);

    // Get source references
    const { data: sources } = await supabase
      .from("game_sources")
      .select("source_name, source_game_id")
      .eq("game_id", game.id);

    const rawgSource = sources?.find((s) => s.source_name === "rawg");
    const igdbSource = sources?.find((s) => s.source_name === "igdb");

    let coverImage = null;
    let headerImage = null;
    let screenshots = game.screenshots || [];

    // Strategy 1: RAWG (primary)
    if (rawgSource && RAWG_KEY) {
      try {
        console.log(`  📡 Trying RAWG (id: ${rawgSource.source_game_id})...`);
        const rawgGame = await fetchRawgGame(rawgSource.source_game_id);

        if (rawgGame.background_image) {
          coverImage = rawgGame.background_image;
          headerImage = rawgGame.background_image_additional || rawgGame.background_image;
          console.log(`  ✅ RAWG cover: ${coverImage.slice(0, 80)}...`);
        }

        // Also grab screenshots if missing
        if (!screenshots || screenshots.length === 0) {
          const rawgScreens = await fetchRawgScreenshots(rawgSource.source_game_id);
          if (rawgScreens.length > 0) {
            screenshots = rawgScreens;
            console.log(`  📸 RAWG screenshots: ${rawgScreens.length}`);
          }
        }

        // Rate limit: 200ms between RAWG calls
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        console.log(`  ⚠️  RAWG failed: ${err.message}`);
      }
    }

    // Strategy 2: IGDB (fallback)
    if (!coverImage && igdbSource) {
      try {
        console.log(`  📡 Trying IGDB (id: ${igdbSource.source_game_id})...`);
        const igdbResult = await fetchIgdbCover(igdbSource.source_game_id);

        if (igdbResult?.coverUrl) {
          coverImage = igdbResult.coverUrl;
          headerImage = igdbResult.coverUrl;
          console.log(`  ✅ IGDB cover: ${coverImage}`);
        }
        if (igdbResult?.screenshots?.length > 0 && (!screenshots || screenshots.length === 0)) {
          screenshots = igdbResult.screenshots;
          console.log(`  📸 IGDB screenshots: ${screenshots.length}`);
        }

        await new Promise((r) => setTimeout(r, 250));
      } catch (err) {
        console.log(`  ⚠️  IGDB failed: ${err.message}`);
      }
    }

    // Strategy 3: RAWG search by title (last resort)
    if (!coverImage && RAWG_KEY) {
      try {
        console.log(`  📡 Trying RAWG search by title: "${game.title}"...`);
        const searchRes = await fetch(
          `${RAWG_BASE}/games?key=${RAWG_KEY}&search=${encodeURIComponent(game.title)}&page_size=3&search_precise=true`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const match = searchData.results?.find(
            (r) => r.background_image && r.name.toLowerCase() === game.title.toLowerCase()
          ) || searchData.results?.find((r) => r.background_image);

          if (match?.background_image) {
            coverImage = match.background_image;
            headerImage = match.background_image;
            console.log(`  ✅ RAWG search cover: ${coverImage.slice(0, 80)}...`);
          }
        }
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        console.log(`  ⚠️  RAWG search failed: ${err.message}`);
      }
    }

    // 3. Update the game if we found media
    if (coverImage) {
      const update = {
        cover_image: coverImage,
        header_image: headerImage || coverImage,
        media_source: "rawg", // Track provenance
      };
      if (screenshots && screenshots.length > 0 && (!game.screenshots || game.screenshots.length === 0)) {
        update.screenshots = screenshots;
      }

      if (dryRun) {
        console.log(`  🔍 DRY RUN: Would update to ${coverImage.slice(0, 60)}...`);
        repaired++;
      } else {
        const { error: updateErr } = await supabase
          .from("games")
          .update(update)
          .eq("id", game.id);

        if (updateErr) {
          console.log(`  ❌ DB update failed: ${updateErr.message}`);
          failed++;
        } else {
          console.log(`  💾 Updated successfully`);
          repaired++;
        }
      }
    } else {
      console.log(`  ❌ No image found from any source`);
      failed++;
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`🔧 Repair complete: ${repaired} fixed, ${failed} still missing`);
  console.log(`   Total: ${gamesToRepair.length} processed`);
  console.log(`\nUsage:`);
  console.log(`  node scripts/repair-missing-media.mjs                  # Repair null/empty covers`);
  console.log(`  node scripts/repair-missing-media.mjs --validate-broken # Find & repair broken Steam covers`);
  console.log(`  node scripts/repair-missing-media.mjs --dry-run        # Preview changes without writing`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
