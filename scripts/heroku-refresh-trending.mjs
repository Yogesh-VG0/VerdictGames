#!/usr/bin/env node

/**
 * VERDICT.GAMES — Heroku Scheduler: Refresh Trending
 *
 * Runs via Heroku Scheduler every 6 hours:
 *   Step 0 — Fetch Steam's GLOBAL Top 100 most-played games
 *   Step 1 — Auto-ingest any top-100 games missing from our DB
 *   Step 2 — Refresh current_players for ALL our Steam games
 *   Step 3 — Rank trending by current_players DESC (truly global)
 *   Step 4 — IGDB PopScore fallback (for non-Steam, if < 20)
 *   Step 5 — Recency fill (if still < 20)
 *   Step 6 — Apply trending + featured flags
 *
 * Heroku Scheduler: node scripts/heroku-refresh-trending.mjs
 *
 * Required Config Vars:
 *   DATABASE_URL, RAWG_API_KEY, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET,
 *   CRON_SECRET, API_URL (Vercel deployment URL)
 */

import postgres from "postgres";

// Load .env for local dev; Heroku has Config Vars
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
  // .env not found — running on Heroku
}

const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false } });
const IGDB_BASE = "https://api.igdb.com/v4";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const STEAM_API = "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1";
const STEAM_CHARTS_API = "https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/";
const CRON_SECRET = process.env.CRON_SECRET || "";
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// ── Helpers ──
async function getIgdbToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch(TWITCH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { token: data.access_token, clientId };
  } catch { return null; }
}

async function igdbQuery(endpoint, body, auth) {
  try {
    const res = await fetch(`${IGDB_BASE}/${endpoint}`, {
      method: "POST",
      headers: { "Client-ID": auth.clientId, Authorization: `Bearer ${auth.token}`, "Content-Type": "text/plain" },
      body,
    });
    if (!res.ok) { console.error(`  IGDB /${endpoint} failed: ${res.status}`); return []; }
    return await res.json();
  } catch (e) { console.error(`  IGDB /${endpoint} error:`, e.message); return []; }
}

function slugify(str) {
  return str.toLowerCase().replace(/['']/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Resolve Steam App ID → game name via store API */
async function getSteamAppName(appId) {
  try {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const info = data?.[String(appId)];
    if (!info?.success) return null;
    return info.data?.name ?? null;
  } catch { return null; }
}

// ═══════════════════════ MAIN ═══════════════════════

const start = Date.now();
console.log("═══════════════════════════════════════════");
console.log("  VERDICT.GAMES — Trending & Featured Sync");
console.log(`  ${new Date().toISOString()}`);
console.log("═══════════════════════════════════════════\n");

const trendingIds = [];
const matched = [];

// ── Step 0: Fetch Steam Global Top 100 ──
console.log("🌍 Step 0: Fetching Steam Global Top 100 most-played...");
let globalTop = [];
try {
  const res = await fetch(STEAM_CHARTS_API, { signal: AbortSignal.timeout(15000) });
  if (res.ok) {
    const data = await res.json();
    globalTop = (data?.response?.ranks ?? [])
      .filter((r) => r.appid && r.concurrent_in_game > 0)
      .slice(0, 100);
    console.log(`  ✓ Got ${globalTop.length} games from Steam Charts`);
  } else {
    console.log(`  ⚠ Steam Charts API returned ${res.status}, falling back to DB-only`);
  }
} catch (e) {
  console.log(`  ⚠ Steam Charts API failed: ${e.message}, falling back to DB-only`);
}

// ── Step 1: Auto-ingest missing top games ──
if (globalTop.length > 0) {
  const ourApps = await sql`SELECT steam_app_id FROM games WHERE steam_app_id IS NOT NULL`;
  const ourAppSet = new Set(ourApps.map((r) => r.steam_app_id));

  const missing = globalTop.filter((r) => !ourAppSet.has(r.appid));
  console.log(`\n🆕 Step 1: ${missing.length} top Steam games not in our DB`);

  if (missing.length > 0 && CRON_SECRET && API_URL !== "http://localhost:3000") {
    // Auto-ingest up to 20 missing games per run (to avoid overloading)
    const toIngest = missing.slice(0, 20);
    let ingested = 0;

    for (const game of toIngest) {
      const name = await getSteamAppName(game.appid);
      if (!name) { console.log(`  ⚠ Could not resolve name for appid ${game.appid}`); continue; }

      try {
        const res = await fetch(`${API_URL}/api/ingest/game`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${CRON_SECRET}`,
          },
          body: JSON.stringify({ query: name }),
          signal: AbortSignal.timeout(30000),
        });
        if (res.ok) {
          ingested++;
          console.log(`  ✓ Ingested: ${name} (appid ${game.appid})`);
        } else {
          const text = await res.text().catch(() => "");
          console.log(`  ✗ Failed to ingest ${name}: ${res.status} ${text.slice(0, 100)}`);
        }
      } catch (e) {
        console.log(`  ✗ Ingest error for ${name}: ${e.message}`);
      }

      // Small delay between ingests
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log(`  Ingested ${ingested}/${toIngest.length} new games`);
  } else if (missing.length > 0) {
    console.log(`  ⚠ Skipping auto-ingest (no CRON_SECRET or API_URL not set)`);
  }
}

// ── Step 2: Update player counts from global data + per-game API ──
console.log("\n🔄 Step 2: Refreshing Steam current player counts...");
const steamGames = await sql`SELECT id, title, steam_app_id FROM games WHERE steam_app_id IS NOT NULL ORDER BY score DESC`;
console.log(`  ${steamGames.length} games with Steam App IDs`);

// Build a map of global data for fast lookup
const globalPlayerMap = new Map();
for (const g of globalTop) {
  globalPlayerMap.set(g.appid, g.concurrent_in_game);
}

let playerUpdates = 0;
const now = new Date().toISOString();

for (let i = 0; i < steamGames.length; i += 10) {
  const batch = steamGames.slice(i, i + 10);
  const results = await Promise.allSettled(
    batch.map(async (g) => {
      // Use global data if available (saves API calls)
      const globalPlayers = globalPlayerMap.get(g.steam_app_id);
      if (globalPlayers !== undefined) {
        return { id: g.id, players: globalPlayers };
      }

      // Otherwise fetch individually
      try {
        const res = await fetch(`${STEAM_API}?appid=${g.steam_app_id}`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.response?.result !== 1) return null;
        return { id: g.id, players: data.response.player_count };
      } catch { return null; }
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      await sql`UPDATE games SET current_players = ${r.value.players}, players_updated_at = ${now} WHERE id = ${r.value.id}`;
      playerUpdates++;
    }
  }

  // Rate limit: 500ms between batches
  if (i + 10 < steamGames.length) await new Promise((r) => setTimeout(r, 500));
}
console.log(`  Updated ${playerUpdates} player counts\n`);

// ── Step 3: Steam Most Played (PRIMARY trending signal) ──
console.log("🎮 Step 3: Steam Most Played (current_players DESC)...");
const mostPlayed = await sql`
  SELECT id, title, score, current_players
  FROM games
  WHERE current_players IS NOT NULL AND current_players > 0
  ORDER BY current_players DESC
  LIMIT 20
`;

for (const g of mostPlayed) {
  if (trendingIds.length >= 20) break;
  trendingIds.push(g.id);
  matched.push({ title: g.title, score: g.score, source: "Steam Most Played", players: g.current_players });
}
console.log(`  ${trendingIds.length} games from Steam Most Played`);

// ── Step 4: IGDB PopScore fallback (for non-Steam or if < 20) ──
if (trendingIds.length < 20) {
  console.log(`\n🎯 Step 4: IGDB PopScore fallback (need ${20 - trendingIds.length} more)...`);
  const auth = await getIgdbToken();

  if (auth) {
    console.log("  ✓ IGDB token obtained");
    const [visits, wantToPlay, playing, steamPeak] = await Promise.all([
      igdbQuery("popularity_primitives", "fields game_id, value, popularity_type; sort value desc; limit 100; where popularity_type = 1;", auth),
      igdbQuery("popularity_primitives", "fields game_id, value, popularity_type; sort value desc; limit 100; where popularity_type = 2;", auth),
      igdbQuery("popularity_primitives", "fields game_id, value, popularity_type; sort value desc; limit 100; where popularity_type = 3;", auth),
      igdbQuery("popularity_primitives", "fields game_id, value, popularity_type; sort value desc; limit 100; where popularity_type = 5;", auth),
    ]);

    const scoreMap = new Map();
    function addScores(items, weight) {
      if (!items?.length) return;
      const maxVal = items[0]?.value || 1;
      for (const item of items) { scoreMap.set(item.game_id, (scoreMap.get(item.game_id) || 0) + (item.value / maxVal) * weight); }
    }
    addScores(visits, 0.25); addScores(wantToPlay, 0.30); addScores(playing, 0.30); addScores(steamPeak, 0.15);

    const sortedIgdb = [...scoreMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
    const igdbIds = sortedIgdb.map(([id]) => id);
    const igdbGames = igdbIds.length > 0 ? await igdbQuery("games", `fields name, slug, first_release_date; where id = (${igdbIds.join(",")}); limit 50;`, auth) : [];
    const igdbNameMap = new Map(igdbGames.map((g) => [g.id, g]));

    for (const [igdbId, popScore] of sortedIgdb) {
      if (trendingIds.length >= 20) break;
      const igdbGame = igdbNameMap.get(igdbId);
      if (!igdbGame) continue;
      const ourSlug = slugify(igdbGame.name);
      const [m] = await sql`SELECT id, title, score FROM games WHERE slug = ${igdbGame.slug} OR slug = ${ourSlug} LIMIT 1`;
      if (m && !trendingIds.includes(m.id)) { trendingIds.push(m.id); matched.push({ title: m.title, score: m.score, source: "IGDB PopScore", popScore: popScore.toFixed(3) }); continue; }
      const [nm] = await sql`SELECT id, title, score FROM games WHERE LOWER(title) = LOWER(${igdbGame.name}) LIMIT 1`;
      if (nm && !trendingIds.includes(nm.id)) { trendingIds.push(nm.id); matched.push({ title: nm.title, score: nm.score, source: "IGDB name", popScore: popScore.toFixed(3) }); }
    }
    console.log(`  Matched ${trendingIds.length} total after IGDB`);
  } else {
    console.log("  ⚠ IGDB not configured, skipping");
  }
}

// ── Step 5: Recency fill ──
if (trendingIds.length < 20) {
  const needed = 20 - trendingIds.length;
  console.log(`\n📊 Step 5: Filling ${needed} with recency-weighted games...`);
  const exclude = trendingIds.length > 0 ? trendingIds : ["00000000-0000-0000-0000-000000000000"];
  const fill = await sql`
    SELECT id, title, score, release_date, (
      (score * 0.25) + (CASE WHEN release_date >= CURRENT_DATE - INTERVAL '6 months' THEN 40 WHEN release_date >= CURRENT_DATE - INTERVAL '1 year' THEN 30 WHEN release_date >= CURRENT_DATE - INTERVAL '2 years' THEN 20 WHEN release_date >= CURRENT_DATE - INTERVAL '4 years' THEN 10 ELSE 0 END) + LEAST(COALESCE(review_count, 0) / 5000.0, 10)
    ) AS ts FROM games WHERE id != ALL(${exclude}) AND release_date IS NOT NULL ORDER BY ts DESC LIMIT ${needed}
  `;
  for (const g of fill) { trendingIds.push(g.id); matched.push({ title: g.title, score: g.score, source: "recency-fill" }); }
}

// ── Step 6: Apply ──
console.log("\n═══════════════════════════════════════════");
console.log("  TRENDING RESULTS");
console.log("═══════════════════════════════════════════");
await sql`UPDATE games SET trending = false, featured = false`;
const uniqueIds = [...new Set(trendingIds)].slice(0, 20);
if (uniqueIds.length > 0) await sql`UPDATE games SET trending = true WHERE id = ANY(${uniqueIds})`;
for (const m of matched) {
  const icon = m.source.includes("Steam") ? "🎮" : m.source.includes("IGDB") ? "🎯" : "📊";
  const extra = m.players ? ` players:${m.players.toLocaleString()}` : m.popScore ? ` pop:${m.popScore}` : "";
  console.log(`  ${icon} [${m.score}] ${m.title} (${m.source}${extra})`);
}
console.log(`\n🔥 Marked ${uniqueIds.length} games as trending`);

// Featured = top 5 by score among trending
const feat = await sql`SELECT id, title, score FROM games WHERE trending = true ORDER BY score DESC LIMIT 5`;
if (feat.length > 0) await sql`UPDATE games SET featured = true WHERE id = ANY(${feat.map((g) => g.id)})`;
console.log(`⭐ Featured: ${feat.map((g) => `${g.title} (${g.score})`).join(", ")}`);

const [{ count }] = await sql`SELECT COUNT(*) as count FROM games`;
const [{ tc }] = await sql`SELECT COUNT(*) as tc FROM games WHERE trending = true`;
const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\n📈 Total: ${count} | Trending: ${tc} | Time: ${elapsed}s`);
await sql.end();
console.log("✅ Done!");
