#!/usr/bin/env node

/**
 * VERDICT.GAMES — Scheduler: Refresh Trending
 *
 * Runs via GitHub Actions every 6 hours:
 *   Step 0 — Fetch Steam's GLOBAL Top 100 most-played games
 *   Step 1 — Auto-ingest any top-100 games missing from our DB
 *   Step 2 — Refresh current_players for ALL our Steam games
 *   Step 3 — Rank trending by current_players DESC (truly global)
 *   Step 4 — IGDB PopScore fallback (for non-Steam, if < 20)
 *   Step 5 — Recency fill (if still < 20)
 *   Step 6 — Apply trending + featured flags
 *
 * Command: node scripts/heroku-refresh-trending.mjs
 *
 * Required Config Vars:
 *   DATABASE_URL, RAWG_API_KEY, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET
 */

import { startRun, finishRun, acquireLock, releaseLock, checkMinInterval } from './lib/scheduler-logger.mjs';
import { connectDb, closeDb } from './lib/db-connect.mjs';
import { ingestGameDirect } from './lib/ingest-pipeline.mjs';

// Load .env for local development; hosted schedulers inject environment variables.
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
  // .env not found; use process environment variables.
}

const sql = connectDb("refresh-trending");
const IGDB_BASE = "https://api.igdb.com/v4";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const STEAM_API = "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1";
const STEAM_CHARTS_API = "https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/";

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

const ROMAN_NUMERAL_TOKENS = {
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
  vii: "7",
  viii: "8",
  ix: "9",
  x: "10",
  xi: "11",
  xii: "12",
  xiii: "13",
  xiv: "14",
  xv: "15",
  xvi: "16",
};

const COUNTER_STRIKE_FAMILY_APP_IDS = new Set([10, 80, 240, 730, 4465480]);

function normalizeTrendingCanonicalTitle(title) {
  return title
    .toLowerCase()
    .replace(/\s*\((?:19|20)\d{2}\)$/g, "")
    .replace(/\b(ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi)\b/gi, (token) => ROMAN_NUMERAL_TOKENS[token.toLowerCase()] ?? token)
    .replace(/[^a-z0-9]+/g, "");
}

function getTrendingGroupKey(row) {
  const steamAppId = Number(row?.steam_app_id);
  if (Number.isFinite(steamAppId) && COUNTER_STRIKE_FAMILY_APP_IDS.has(steamAppId)) {
    return "special:counter-strike";
  }

  return `title:${normalizeTrendingCanonicalTitle(row?.title ?? "")}`;
}

function appendTrendingCandidate(row, match, trendingIds, trendingGroupKeys, matched) {
  if (!row?.id) {
    return false;
  }

  const key = getTrendingGroupKey(row);
  if (!key || trendingGroupKeys.has(key) || trendingIds.includes(row.id)) {
    return false;
  }

  trendingIds.push(row.id);
  trendingGroupKeys.add(key);
  matched.push(match);
  return true;
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

async function applyPlayerCountUpdates(updates, timestamp) {
  let applied = 0;
  for (const update of updates) {
    const players = Number(update?.players);
    if (!update?.id || !Number.isFinite(players)) continue;
    const safeCount = Math.max(0, Math.trunc(players));
    try {
      const result = await sql`
        UPDATE games
        SET current_players = ${safeCount},
            players_updated_at = ${timestamp}
        WHERE id = ${update.id}
      `;
      applied += Number(result.count ?? 0);
    } catch (err) {
      // Non-fatal: skip individual update failures
    }
  }
  return applied;
}

async function refreshMomentumFromLatestSnapshots() {
  const result = await sql`
    WITH latest_snapshots AS (
      SELECT DISTINCT ON (game_id) game_id, player_count
      FROM player_snapshots
      WHERE player_count > 0
      ORDER BY game_id, recorded_at DESC
    )
    UPDATE games AS g
    SET momentum = ROUND(
      LN((g.current_players + 1)::numeric) - LN((latest_snapshots.player_count + 1)::numeric),
      4
    )
    FROM latest_snapshots
    WHERE g.id = latest_snapshots.game_id
      AND g.current_players IS NOT NULL
      AND g.current_players > 0
  `;
  return Number(result.count ?? 0);
}

// ═══════════════════════ MAIN ═══════════════════════

const start = Date.now();
console.log("═══════════════════════════════════════════");
console.log("  VERDICT.GAMES — Trending & Featured Sync");
console.log(`  ${new Date().toISOString()}`);
console.log("═══════════════════════════════════════════\n");

// Skip if last successful run was less than 5 hours ago (effective "every 6h" with hourly trigger)
const MIN_INTERVAL_HOURS = parseFloat(process.env.TRENDING_INTERVAL_HOURS || "5");
const shouldRun = await checkMinInterval(sql, 'refresh-trending', MIN_INTERVAL_HOURS);
if (!shouldRun) { await closeDb(sql, 'refresh-trending'); process.exit(0); }

const locked = await acquireLock(sql, 'refresh-trending');
if (!locked) { await closeDb(sql, 'refresh-trending'); process.exit(0); }
const run = await startRun(sql, 'refresh-trending');
const trendingIds = [];
const trendingGroupKeys = new Set();
const matched = [];
let caughtError = null;

const QUALITY_FLOOR_SQL = sql`
  (
    is_trending_manual = true
    OR COALESCE(verdict_score, score, 0) >= 72
    OR (COALESCE(current_players, 0) >= 5000 AND COALESCE(verdict_score, score, 0) >= 68)
    OR (COALESCE(momentum, 0) >= 0.18 AND COALESCE(current_players, 0) >= 1000 AND COALESCE(verdict_score, score, 0) >= 68)
  )
`;

try {

// ── Step 0: Fetch Steam Global Top 100 ──
console.log("🌍 Step 0: Fetching Steam Global Top 100 most-played...");
let globalTop = [];
try {
  // ISteamChartsService may require a Steam Web API key on some infrastructure
  const steamKey = process.env.STEAM_API_KEY || process.env.STEAM_WEB_API_KEY;
  const chartsUrl = steamKey
    ? `${STEAM_CHARTS_API}?key=${steamKey}`
    : STEAM_CHARTS_API;
  const res = await fetch(chartsUrl, { signal: AbortSignal.timeout(15000) });
  if (res.ok) {
    const data = await res.json();
    globalTop = (data?.response?.ranks ?? [])
      .filter((r) => r.appid && r.peak_in_game > 0)
      .slice(0, 100);
    console.log(`  ✓ Got ${globalTop.length} games from Steam Charts`);
    if (globalTop.length === 0) {
      console.log(`  ⚠ Steam Charts returned empty ranks. Response keys: ${JSON.stringify(Object.keys(data?.response ?? {}))}`);
      if (!steamKey) {
        console.log(`  💡 Tip: Set STEAM_API_KEY config var for reliable Steam Charts access`);
      }
    }
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

  if (missing.length > 0) {
    // Auto-ingest up to 20 missing games per run via local pipeline
    const toIngest = missing.slice(0, 20);
    let ingested = 0;

    for (const game of toIngest) {
      const name = await getSteamAppName(game.appid);
      if (!name) { console.log(`  ⚠ Could not resolve name for appid ${game.appid}`); continue; }

      try {
        const result = await ingestGameDirect(sql, name);
        if (result.success) {
          ingested++;
          console.log(`  ✓ Ingested: ${name} (appid ${game.appid})`);
        } else {
          console.log(`  ✗ Failed to ingest ${name}: ${result.message}`);
        }
      } catch (e) {
        console.log(`  ✗ Ingest error for ${name}: ${e.message}`);
      }

      // Small delay between ingests
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log(`  Ingested ${ingested}/${toIngest.length} new games`);
  }
}

// ── Step 2: Update current player counts from the per-game API ──
console.log("\n🔄 Step 2: Refreshing Steam current player counts...");
const steamGames = await sql`SELECT id, title, steam_app_id FROM games WHERE steam_app_id IS NOT NULL ORDER BY score DESC`;
console.log(`  ${steamGames.length} games with Steam App IDs`);

let playerUpdates = 0;
const now = new Date().toISOString();
const pendingPlayerUpdates = [];

for (let i = 0; i < steamGames.length; i += 10) {
  const batch = steamGames.slice(i, i + 10);
  const results = await Promise.allSettled(
    batch.map(async (g) => {
      // Steam Charts exposes a rollup peak, not a current count, so always use
      // the live per-game endpoint for this field.
      try {
        const res = await fetch(`${STEAM_API}?appid=${g.steam_app_id}`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.response?.result !== 1) return null;
        return { id: g.id, players: data.response.player_count };
      } catch { return null; }
    })
  );

  const updates = results
    .filter((r) => r.status === "fulfilled" && r.value)
    .map((r) => r.value);
  if (updates.length > 0) {
    pendingPlayerUpdates.push(...updates);
  }

  // Rate limit: 500ms between batches
  if (i + 10 < steamGames.length) await new Promise((r) => setTimeout(r, 500));
}

if (pendingPlayerUpdates.length > 0) {
  playerUpdates = await applyPlayerCountUpdates(pendingPlayerUpdates, now);
}
console.log(`  Updated ${playerUpdates} player counts`);
if (steamGames.length > 0 && playerUpdates === 0) {
  throw new Error(`Steam current-player refresh failed for all ${steamGames.length} games`);
}

// ── Step 2b: Compute momentum + snapshot player counts ──
console.log("\n📸 Step 2b: Computing momentum + snapshotting player counts...");
try {
  const gamesWithPlayers = await sql`
    SELECT id, current_players FROM games
    WHERE current_players IS NOT NULL AND current_players > 0
  `;

  if (gamesWithPlayers.length > 0) {
    // 1) FIRST: compute momentum by comparing fresh current_players against LATEST existing snapshot
    //    This works even if the snapshot was from a previous run hours ago
    const momentumUpdated = await refreshMomentumFromLatestSnapshots();
    console.log(`  📈 Updated momentum for ${momentumUpdated} games`);

    // 2) THEN: insert new snapshot (throttled to avoid duplicates from retries)
    const [recentSnap] = await sql`
      SELECT id FROM player_snapshots
      WHERE recorded_at > NOW() - INTERVAL '5 minutes'
      LIMIT 1
    `;
    if (!recentSnap) {
      for (let i = 0; i < gamesWithPlayers.length; i += 100) {
        const batch = gamesWithPlayers.slice(i, i + 100);
        const values = batch.map(g => ({ game_id: g.id, player_count: g.current_players }));
        await sql`INSERT INTO player_snapshots ${sql(values)}`;
      }
      console.log(`  📸 Snapshotted ${gamesWithPlayers.length} player counts`);
    } else {
      console.log("  ⏭️ Snapshot insert skipped (duplicate protection)");
    }
  }

  const deleted = await sql`
    DELETE FROM player_snapshots
    WHERE recorded_at < NOW() - INTERVAL '7 days'
  `;
  if (deleted.count > 0) console.log(`  🗑️ Cleaned ${deleted.count} old snapshots`);
} catch (e) {
  console.log(`  ⚠ Momentum tracking error: ${e.message}`);
}

// ── Step 3: Steam Most Played (PRIMARY trending signal) ──
// RULE: Only games with cover_image can be trending (public-facing surface)
console.log("🎮 Step 3: Steam Most Played (current_players DESC)...");
const mostPlayed = await sql`
  SELECT id, title, score, verdict_score, current_players, review_count, momentum, is_trending_manual, steam_app_id
  FROM games
  WHERE current_players IS NOT NULL AND current_players > 0
    AND cover_image IS NOT NULL AND cover_image != ''
    AND ${QUALITY_FLOOR_SQL}
  ORDER BY current_players DESC
  LIMIT 30
`;

for (const g of mostPlayed) {
  if (trendingIds.length >= 20) break;
  appendTrendingCandidate(
    g,
    { title: g.title, score: g.score, source: "Steam Most Played", players: g.current_players },
    trendingIds,
    trendingGroupKeys,
    matched,
  );
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
      const [m] = await sql`SELECT id, title, score, steam_app_id FROM games WHERE (slug = ${igdbGame.slug} OR slug = ${ourSlug}) AND cover_image IS NOT NULL AND cover_image != '' AND ${QUALITY_FLOOR_SQL} LIMIT 1`;
      if (m && appendTrendingCandidate(m, { title: m.title, score: m.score, source: "IGDB PopScore", popScore: popScore.toFixed(3) }, trendingIds, trendingGroupKeys, matched)) { continue; }
      const [nm] = await sql`SELECT id, title, score, steam_app_id FROM games WHERE LOWER(title) = LOWER(${igdbGame.name}) AND cover_image IS NOT NULL AND cover_image != '' AND ${QUALITY_FLOOR_SQL} LIMIT 1`;
      appendTrendingCandidate(nm, { title: nm?.title, score: nm?.score, source: "IGDB name", popScore: popScore.toFixed(3) }, trendingIds, trendingGroupKeys, matched);
    }
    console.log(`  Matched ${trendingIds.length} total after IGDB`);
  } else {
    console.log("  ⚠ IGDB not configured, skipping");
  }
}

// ── Step 5: Recency fill ──
if (trendingIds.length < 20) {
  const needed = 20 - trendingIds.length;
  const fillLimit = Math.max(needed * 3, 20);
  console.log(`\n📊 Step 5: Filling ${needed} with recency-weighted games...`);
  const exclude = trendingIds.length > 0 ? trendingIds : ["00000000-0000-0000-0000-000000000000"];
  const fill = await sql`
    SELECT id, title, score, release_date, steam_app_id, (
      (score * 0.25) + (CASE WHEN release_date >= CURRENT_DATE - INTERVAL '6 months' THEN 40 WHEN release_date >= CURRENT_DATE - INTERVAL '1 year' THEN 30 WHEN release_date >= CURRENT_DATE - INTERVAL '2 years' THEN 20 WHEN release_date >= CURRENT_DATE - INTERVAL '4 years' THEN 10 ELSE 0 END) + LEAST(COALESCE(review_count, 0) / 5000.0, 10)
    ) AS ts FROM games WHERE id != ALL(${exclude}) AND release_date IS NOT NULL
      AND cover_image IS NOT NULL AND cover_image != ''
      AND COALESCE(verdict_score, score, 0) >= 70
    ORDER BY ts DESC LIMIT ${fillLimit}
  `;
  for (const g of fill) {
    appendTrendingCandidate(
      g,
      { title: g.title, score: g.score, source: "recency-fill" },
      trendingIds,
      trendingGroupKeys,
      matched,
    );
  }
}

// ── Step 6: Apply ──
console.log("\n═══════════════════════════════════════════");
console.log("  TRENDING RESULTS");
console.log("═══════════════════════════════════════════");
const uniqueIds = [...new Set(trendingIds)].slice(0, 20);
await sql`
  UPDATE games
  SET trending = CASE
    WHEN id = ANY(${uniqueIds.length > 0 ? uniqueIds : ["00000000-0000-0000-0000-000000000000"]}) THEN true
    ELSE false
  END
`;
for (const m of matched) {
  const icon = m.source.includes("Steam") ? "🎮" : m.source.includes("IGDB") ? "🎯" : "📊";
  const extra = m.players ? ` players:${m.players.toLocaleString()}` : m.popScore ? ` pop:${m.popScore}` : "";
  console.log(`  ${icon} [${m.score}] ${m.title} (${m.source}${extra})`);
}
console.log(`\n🔥 Marked ${uniqueIds.length} games as trending`);

// NOTE: Featured flag is NOT set here. Featured is editorial-only via is_featured_manual.
// The old code that auto-set "featured = top 5 trending by score" was removed intentionally.
// Use the admin panel or seed-flags.mjs to set is_featured_manual on deserving games.
const [{ fc: featCount }] = await sql`SELECT COUNT(*) as fc FROM games WHERE is_featured_manual = true`;
console.log(`⭐ Featured (editorial): ${featCount} games with is_featured_manual=true`);

const [{ count }] = await sql`SELECT COUNT(*) as count FROM games`;
const [{ tc }] = await sql`SELECT COUNT(*) as tc FROM games WHERE trending = true`;
const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\n📈 Total: ${count} | Trending: ${tc} | Time: ${elapsed}s`);
await finishRun(sql, run.id, {
  rows_scanned: steamGames.length,
  rows_updated: playerUpdates + uniqueIds.length,
  metadata: { totalGames: Number(count), trending: Number(tc), elapsed },
});
console.log("✅ Done!");
} catch (err) {
  caughtError = err;
  const errorMessage = err?.message ?? String(err);
  console.error(`❌ Refresh trending failed: ${errorMessage}`);
  await finishRun(sql, run.id, { error_message: errorMessage });
} finally {
  await releaseLock(sql, 'refresh-trending');
  await closeDb(sql, 'refresh-trending');
}

if (caughtError) {
  process.exit(1);
}
