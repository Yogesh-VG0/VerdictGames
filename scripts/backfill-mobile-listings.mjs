#!/usr/bin/env node

/**
 * VERDICT.GAMES — Backfill Mobile Store Listings
 *
 * Verifies existing games tagged with Android/iOS platforms against
 * real Google Play and App Store listings. Creates verified entries
 * in the mobile_store_listings table.
 *
 * Usage:
 *   node scripts/backfill-mobile-listings.mjs                # verify all
 *   node scripts/backfill-mobile-listings.mjs --android-only  # Android only
 *   node scripts/backfill-mobile-listings.mjs --ios-only      # iOS only
 *   node scripts/backfill-mobile-listings.mjs --limit=50      # limit batch size
 *   node scripts/backfill-mobile-listings.mjs --dry-run       # preview only
 *
 * Required env vars: DATABASE_URL or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

// Load .env for local runs
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
} catch { /* .env not found */ }

import { connectDb } from "./lib/db-connect.mjs";
import { checkMinInterval, startRun, finishRun, acquireLock, releaseLock } from "./lib/scheduler-logger.mjs";

const sql = connectDb("backfill-mobile");

const ANDROID_ONLY = process.argv.includes("--android-only");
const IOS_ONLY = process.argv.includes("--ios-only");
const DRY_RUN = process.argv.includes("--dry-run");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : 999;

const THROTTLE_MS = 1500; // delay between scraper calls to avoid bans

const JOB_NAME = ANDROID_ONLY ? 'backfill-mobile-android' : IOS_ONLY ? 'backfill-mobile-ios' : 'backfill-mobile';

// Skip if last successful run was less than 11 hours ago (effective "every 12h" with hourly trigger)
if (!DRY_RUN) {
  const MIN_INTERVAL_HOURS = parseFloat(process.env.MOBILE_BACKFILL_INTERVAL_HOURS || "11");
  const shouldRun = await checkMinInterval(sql, JOB_NAME, MIN_INTERVAL_HOURS);
  if (!shouldRun) { await sql.end(); process.exit(0); }
}

const locked = !DRY_RUN ? await acquireLock(sql, JOB_NAME) : true;
if (!locked) { await sql.end(); process.exit(0); }

const schedulerRun = !DRY_RUN ? await startRun(sql, JOB_NAME, { androidOnly: ANDROID_ONLY, iosOnly: IOS_ONLY, limit: LIMIT }) : { id: null };
const startedAt = Date.now();

console.log("═══════════════════════════════════════════");
console.log("  VERDICT.GAMES — Backfill Mobile Listings");
console.log(`  Android: ${!IOS_ONLY ? "YES" : "SKIP"}`);
console.log(`  iOS:     ${!ANDROID_ONLY ? "YES" : "SKIP"}`);
console.log(`  Limit:   ${LIMIT}`);
console.log(`  Dry run: ${DRY_RUN}`);
console.log(`  ${new Date().toISOString()}`);
console.log("═══════════════════════════════════════════\n");

// ── Helpers ──

function normalizeForMatch(title) {
  return title
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(hd|lite|free|se|remastered|enhanced edition|definitive edition|premium|deluxe|complete|goty)\b/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function titleSimilarity(a, b) {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (na === nb) return 100;
  if (na.startsWith(nb) || nb.startsWith(na)) return 85;
  const tokensA = new Set(na.split(" ").filter(Boolean));
  const tokensB = new Set(nb.split(" ").filter(Boolean));
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? Math.round((intersection / union) * 100) : 0;
}

/**
 * Confidence-tiered matching:
 * - ≥90% title similarity → auto-attach
 * - ≥80% title similarity + developer overlap → auto-attach
 * - otherwise → skip
 */
function isHighConfidenceMatch(gameTitle, gameDev, storeTitle, storeDev, similarity) {
  if (similarity >= 90) return true;
  if (similarity >= 80) {
    const devA = (gameDev || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const devB = (storeDev || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (devA && devB && (devA.includes(devB) || devB.includes(devA))) return true;
    const tokA = new Set((gameDev || "").toLowerCase().split(/\s+/).filter(t => t.length > 2));
    const tokB = new Set((storeDev || "").toLowerCase().split(/\s+/).filter(t => t.length > 2));
    const overlap = [...tokA].filter(t => tokB.has(t)).length;
    if (overlap >= 1 && (tokA.size <= 3 || tokB.size <= 3)) return true;
  }
  return false;
}

function extractPackageName(url) {
  if (!url) return null;
  const match = url.match(/[?&]id=([a-zA-Z0-9_.]+)/);
  return match?.[1] ?? null;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Scraper imports (lazy) ──

let gplay = null;
async function getGplay() {
  if (!gplay) {
    const mod = await import("google-play-scraper");
    gplay = mod.default ?? mod;
  }
  return gplay;
}

// ── Main ──

const stats = {
  android: { checked: 0, verified: 0, failed: 0, skipped: 0 },
  ios: { checked: 0, verified: 0, failed: 0, skipped: 0 },
};

// Get games tagged with Android/iOS that don't already have verified listings
async function getGamesToVerify(platform, store) {
  const rows = await sql`
    SELECT g.id, g.title, g.play_store_url, g.developer
    FROM games g
    WHERE g.platforms @> ARRAY[${platform}]::text[]
      AND NOT EXISTS (
        SELECT 1 FROM mobile_store_listings msl
        WHERE msl.game_id = g.id AND msl.store = ${store} AND msl.is_verified = true
      )
    ORDER BY g.review_count DESC, g.score DESC
    LIMIT ${LIMIT}
  `;
  return rows;
}

try {
  // ── Android Backfill ──
  if (!IOS_ONLY) {
    console.log("── Android Verification ──\n");
    const games = await getGamesToVerify("Android", "google_play");
    console.log(`Found ${games.length} Android-tagged games without verified listings.\n`);

    for (const game of games) {
      stats.android.checked++;
      const label = `[${stats.android.checked}/${games.length}] ${game.title}`;

      try {
        const scraper = await getGplay();

        let packageName = extractPackageName(game.play_store_url);
        let appData = null;

        if (packageName) {
          try {
            appData = await scraper.app({ appId: packageName });
          } catch {
            appData = null;
          }
        }

        if (!appData) {
          await sleep(THROTTLE_MS);
          const results = await scraper.search({
            term: game.title,
            num: 5,
          });

          let bestMatch = null;
          let bestSim = 0;
          for (const r of results) {
            const sim = titleSimilarity(game.title, r.title);
            if (sim > bestSim) {
              bestSim = sim;
              bestMatch = r;
            }
          }

          if (bestMatch && isHighConfidenceMatch(game.title, game.developer ?? "", bestMatch.title, bestMatch.developer ?? "", bestSim)) {
            packageName = bestMatch.appId;
            await sleep(THROTTLE_MS);
            try {
              appData = await scraper.app({ appId: packageName });
            } catch {
              appData = null;
            }
            if (appData && appData.genreId && !appData.genreId.startsWith("GAME")) {
              console.log(`  ⚠ ${label} — match "${appData.title}" is not a game (${appData.genreId}), skipping`);
              stats.android.skipped++;
              continue;
            }
          } else if (bestMatch) {
            console.log(
              `  ⚠ ${label} — best match "${bestMatch.title}" (dev: ${bestMatch.developer ?? "?"}) sim=${bestSim}% — below confidence threshold`
            );
            stats.android.skipped++;
            continue;
          } else {
            console.log(`  ✗ ${label} — no results on Google Play`);
            stats.android.failed++;
            continue;
          }
        }

        if (!appData || !packageName) {
          console.log(`  ✗ ${label} — could not fetch app details`);
          stats.android.failed++;
          continue;
        }

        if (DRY_RUN) {
          console.log(
            `  ✓ ${label} → ${packageName} (${appData.title}, ${appData.score ?? "no score"}, ${appData.installs})`
          );
          stats.android.verified++;
          continue;
        }

        await sql`
          INSERT INTO mobile_store_listings (
            game_id, store, external_id, store_url, title, developer,
            icon_url, header_image_url, screenshots,
            rating_average, rating_count, review_count,
            installs, real_installs, price, currency,
            is_free, offers_iap, iap_range,
            genre, genre_id, content_rating, version,
            released_at, last_updated_at,
            is_verified, last_verified_at
          ) VALUES (
            ${game.id}, 'google_play', ${packageName},
            ${appData.url}, ${appData.title}, ${appData.developer},
            ${appData.icon}, ${appData.headerImage ?? null},
            ${appData.screenshots?.slice(0, 8) ?? []},
            ${appData.score ?? null}, ${appData.ratings ?? 0}, ${appData.reviews ?? 0},
            ${appData.installs ?? null}, ${appData.maxInstalls ?? null},
            ${appData.price ?? 0}, ${appData.currency ?? "USD"},
            ${appData.free ?? true}, ${appData.offersIAP ?? false},
            ${appData.IAPRange ?? null},
            ${appData.genre ?? null}, ${appData.genreId ?? null},
            ${appData.contentRating ?? null}, ${appData.version ?? null},
            ${appData.released ?? null},
            ${appData.updated ? new Date(appData.updated * 1000).toISOString() : null},
            true, NOW()
          )
          ON CONFLICT (store, external_id) DO UPDATE SET
            game_id = EXCLUDED.game_id,
            store_url = EXCLUDED.store_url,
            title = EXCLUDED.title,
            developer = EXCLUDED.developer,
            icon_url = EXCLUDED.icon_url,
            rating_average = EXCLUDED.rating_average,
            rating_count = EXCLUDED.rating_count,
            review_count = EXCLUDED.review_count,
            installs = EXCLUDED.installs,
            real_installs = EXCLUDED.real_installs,
            is_verified = true,
            last_verified_at = NOW()
        `;

        if (!game.play_store_url && appData.url) {
          await sql`
            UPDATE games SET play_store_url = ${appData.url} WHERE id = ${game.id}
          `;
        }

        console.log(
          `  ✓ ${label} → ${packageName} (★${appData.score ?? "?"}, ${appData.installs})`
        );
        stats.android.verified++;
      } catch (err) {
        console.log(`  ✗ ${label} — error: ${err.message}`);
        stats.android.failed++;
      }

      await sleep(THROTTLE_MS);
    }
  }

  // ── iOS Backfill ──
  if (!ANDROID_ONLY) {
    console.log("\n── iOS Verification ──\n");
    const games = await getGamesToVerify("iOS", "app_store");
    console.log(`Found ${games.length} iOS-tagged games without verified listings.\n`);

    for (const game of games) {
      stats.ios.checked++;
      const label = `[${stats.ios.checked}/${games.length}] ${game.title}`;

      try {
        const params = new URLSearchParams({
          term: game.title,
          entity: "software",
          media: "software",
          country: "us",
          limit: "5",
        });

        const res = await fetch(`https://itunes.apple.com/search?${params}`, {
          headers: { "User-Agent": "VerdictGames/1.0" },
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          console.log(`  ✗ ${label} — Apple API returned ${res.status}`);
          stats.ios.failed++;
          await sleep(3500);
          continue;
        }

        const data = await res.json();
        const results = data.results ?? [];
        const gameResults = results.filter(
          (r) => r.genreIds?.includes("6014") || r.primaryGenreName?.includes("Games")
        );

        let bestMatch = null;
        let bestSim = 0;
        for (const r of gameResults) {
          const sim = titleSimilarity(game.title, r.trackName ?? "");
          if (sim > bestSim) {
            bestSim = sim;
            bestMatch = r;
          }
        }

        if (!bestMatch || !isHighConfidenceMatch(game.title, game.developer ?? "", bestMatch.trackName ?? "", bestMatch.artistName ?? "", bestSim)) {
          if (bestMatch) {
            console.log(
              `  ⚠ ${label} — best match "${bestMatch.trackName}" (dev: ${bestMatch.artistName ?? "?"}) sim=${bestSim}% — below confidence threshold`
            );
          } else {
            console.log(`  ✗ ${label} — no game results on App Store`);
          }
          stats.ios.skipped++;
          await sleep(3500);
          continue;
        }

        if (DRY_RUN) {
          console.log(
            `  ✓ ${label} → ${bestMatch.bundleId} (${bestMatch.trackName}, ★${bestMatch.averageUserRating ?? "?"})`
          );
          stats.ios.verified++;
          await sleep(3500);
          continue;
        }

        await sql`
          INSERT INTO mobile_store_listings (
            game_id, store, external_id, store_url, title, developer,
            icon_url, screenshots,
            rating_average, rating_count,
            price, currency, is_free,
            genre, content_rating, version,
            released_at, last_updated_at,
            is_verified, last_verified_at
          ) VALUES (
            ${game.id}, 'app_store', ${String(bestMatch.trackId)},
            ${bestMatch.trackViewUrl}, ${bestMatch.trackName}, ${bestMatch.artistName},
            ${bestMatch.artworkUrl512 ?? bestMatch.artworkUrl100},
            ${bestMatch.screenshotUrls?.slice(0, 8) ?? []},
            ${bestMatch.averageUserRating ?? null}, ${bestMatch.userRatingCount ?? 0},
            ${bestMatch.price ?? 0}, ${bestMatch.currency ?? "USD"},
            ${(bestMatch.price ?? 0) === 0},
            ${bestMatch.primaryGenreName ?? null},
            ${bestMatch.contentAdvisoryRating ?? null},
            ${bestMatch.version ?? null},
            ${bestMatch.releaseDate ?? null},
            ${bestMatch.currentVersionReleaseDate ?? null},
            true, NOW()
          )
          ON CONFLICT (store, external_id) DO UPDATE SET
            game_id = EXCLUDED.game_id,
            store_url = EXCLUDED.store_url,
            title = EXCLUDED.title,
            developer = EXCLUDED.developer,
            icon_url = EXCLUDED.icon_url,
            rating_average = EXCLUDED.rating_average,
            rating_count = EXCLUDED.rating_count,
            is_verified = true,
            last_verified_at = NOW()
        `;

        console.log(
          `  ✓ ${label} → ${bestMatch.bundleId} (★${bestMatch.averageUserRating ?? "?"})`
        );
        stats.ios.verified++;
      } catch (err) {
        console.log(`  ✗ ${label} — error: ${err.message}`);
        stats.ios.failed++;
      }

      await sleep(3500);
    }
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  Summary");
  console.log("═══════════════════════════════════════════");
  if (!IOS_ONLY) {
    console.log(`  Android: ${stats.android.verified} verified, ${stats.android.skipped} skipped, ${stats.android.failed} failed (of ${stats.android.checked} checked)`);
  }
  if (!ANDROID_ONLY) {
    console.log(`  iOS:     ${stats.ios.verified} verified, ${stats.ios.skipped} skipped, ${stats.ios.failed} failed (of ${stats.ios.checked} checked)`);
  }
  console.log("═══════════════════════════════════════════\n");

  if (!DRY_RUN) {
    const totalVerified = (stats.android?.verified ?? 0) + (stats.ios?.verified ?? 0);
    const totalFailed = (stats.android?.failed ?? 0) + (stats.ios?.failed ?? 0);
    const totalChecked = (stats.android?.checked ?? 0) + (stats.ios?.checked ?? 0);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    await finishRun(sql, schedulerRun?.id, {
      rows_scanned: totalChecked,
      rows_updated: totalVerified,
      rows_skipped: (stats.android?.skipped ?? 0) + (stats.ios?.skipped ?? 0),
      metadata: { failed: totalFailed, elapsed },
    });
  }
} catch (err) {
  console.error(`❌ Backfill mobile listings failed:`, err.message);
  if (!DRY_RUN) {
    await finishRun(sql, schedulerRun?.id, { error_message: err.message });
  }
  if (!DRY_RUN) {
    await releaseLock(sql, JOB_NAME);
  }
  await sql.end();
  process.exit(1);
}

if (!DRY_RUN) {
  await releaseLock(sql, JOB_NAME);
}
await sql.end();
