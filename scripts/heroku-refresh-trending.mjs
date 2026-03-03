#!/usr/bin/env node

/**
 * VERDICT.GAMES — Heroku Scheduler: Refresh Trending
 *
 * Runs via Heroku Scheduler every 6 hours to update trending/featured flags
 * using IGDB PopScore as primary source, RAWG as fallback.
 *
 * Heroku Scheduler command: node scripts/heroku-refresh-trending.mjs
 *
 * Required Heroku Config Vars:
 *   DATABASE_URL, RAWG_API_KEY, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET
 */

import postgres from "postgres";

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

const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false } });
const RAWG_KEY = process.env.RAWG_API_KEY;
const RAWG_BASE = "https://api.rawg.io/api";
const IGDB_BASE = "https://api.igdb.com/v4";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";

// ── IGDB Auth ──
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

function dateRange(daysBack, daysForward = 0) {
  const now = new Date();
  const from = new Date(now); from.setDate(from.getDate() - daysBack);
  const to = new Date(now); to.setDate(to.getDate() + daysForward);
  return `${from.toISOString().slice(0, 10)},${to.toISOString().slice(0, 10)}`;
}

async function fetchRawgList(ordering, dates, size = 20) {
  const params = new URLSearchParams({ key: RAWG_KEY, ordering, page_size: String(size), ...(dates ? { dates } : {}) });
  try {
    const res = await fetch(`${RAWG_BASE}/games?${params}`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results ?? []).map((g) => ({ name: g.name, slug: g.slug, added: g.added ?? 0, rating: g.rating ?? 0, released: g.released }));
  } catch { return []; }
}

function slugify(str) {
  return str.toLowerCase().replace(/['']/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ═══════════════════════ MAIN ═══════════════════════

const start = Date.now();
console.log("═══════════════════════════════════════════");
console.log("  VERDICT.GAMES — Trending & Featured Sync");
console.log(`  ${new Date().toISOString()}`);
console.log("═══════════════════════════════════════════\n");

const trendingIds = [];
const matched = [];

// ── Step 0: Refresh Steam player counts ──
console.log("🔄 Step 0: Refreshing Steam current player counts...");
const steamGames = await sql`SELECT id, title, steam_app_id FROM games WHERE steam_app_id IS NOT NULL ORDER BY score DESC`;
console.log(`  ${steamGames.length} games with Steam App IDs`);

let playerUpdates = 0;
const STEAM_API = "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1";

// Process in batches of 10 with 500ms delay between batches
for (let i = 0; i < steamGames.length; i += 10) {
  const batch = steamGames.slice(i, i + 10);
  const results = await Promise.allSettled(
    batch.map(async (g) => {
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
      await sql`UPDATE games SET current_players = ${r.value.players} WHERE id = ${r.value.id}`;
      playerUpdates++;
    }
  }

  // Rate limit: 500ms between batches
  if (i + 10 < steamGames.length) await new Promise((r) => setTimeout(r, 500));
}
console.log(`  Updated ${playerUpdates} player counts\n`);

// ── Step 1: Steam Most Played (PRIMARY trending signal) ──
console.log("🎮 Step 1: Steam Most Played (current_players DESC)...");
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

// ── Step 2: IGDB PopScore fallback (for non-Steam or if < 20) ──
if (trendingIds.length < 20) {
  console.log(`\n🎯 Step 2: IGDB PopScore fallback (need ${20 - trendingIds.length} more)...`);
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

// ── Step 3: Recency fill ──
if (trendingIds.length < 20) {
  const needed = 20 - trendingIds.length;
  console.log(`\n📊 Step 3: Filling ${needed} with recency-weighted games...`);
  const exclude = trendingIds.length > 0 ? trendingIds : ["00000000-0000-0000-0000-000000000000"];
  const fill = await sql`
    SELECT id, title, score, release_date, (
      (score * 0.25) + (CASE WHEN release_date >= CURRENT_DATE - INTERVAL '6 months' THEN 40 WHEN release_date >= CURRENT_DATE - INTERVAL '1 year' THEN 30 WHEN release_date >= CURRENT_DATE - INTERVAL '2 years' THEN 20 WHEN release_date >= CURRENT_DATE - INTERVAL '4 years' THEN 10 ELSE 0 END) + LEAST(COALESCE(review_count, 0) / 5000.0, 10)
    ) AS ts FROM games WHERE id != ALL(${exclude}) AND release_date IS NOT NULL ORDER BY ts DESC LIMIT ${needed}
  `;
  for (const g of fill) { trendingIds.push(g.id); matched.push({ title: g.title, score: g.score, source: "recency-fill" }); }
}

// ── Step 4: Apply ──
console.log("\n═══════════════════════════════════════════");
console.log("  TRENDING RESULTS");
console.log("═══════════════════════════════════════════");
await sql`UPDATE games SET trending = false, featured = false`;
const uniqueIds = [...new Set(trendingIds)].slice(0, 20);
if (uniqueIds.length > 0) await sql`UPDATE games SET trending = true WHERE id = ANY(${uniqueIds})`;
for (const m of matched) {
  const icon = m.source.includes("Steam") ? "🎮" : m.source.includes("IGDB") ? "🎯" : m.source.includes("RAWG") ? "🌐" : "📊";
  const extra = m.players ? ` players:${m.players.toLocaleString()}` : m.popScore ? ` pop:${m.popScore}` : "";
  console.log(`  ${icon} [${m.score}] ${m.title} (${m.source}${extra})`);
}
console.log(`\n🔥 Marked ${uniqueIds.length} games as trending`);

// ── Featured ──
const feat = await sql`SELECT id, title, score FROM games WHERE trending = true ORDER BY score DESC LIMIT 5`;
if (feat.length > 0) await sql`UPDATE games SET featured = true WHERE id = ANY(${feat.map((g) => g.id)})`;
console.log(`⭐ Featured: ${feat.map((g) => `${g.title} (${g.score})`).join(", ")}`);

const [{ count }] = await sql`SELECT COUNT(*) as count FROM games`;
const [{ tc }] = await sql`SELECT COUNT(*) as tc FROM games WHERE trending = true`;
const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\n📈 Total: ${count} | Trending: ${tc} | Time: ${elapsed}s`);
await sql.end();
console.log("✅ Done!");
