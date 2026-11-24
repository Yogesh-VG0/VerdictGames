import { connectDb, closeDb } from './lib/db-connect.mjs';
import { acquireLock, releaseLock, startRun, finishRun, isInfrastructureDbError } from './lib/scheduler-logger.mjs';
import { refreshDiscoverySnapshot } from './lib/discovery-snapshot.mjs';
import { discoverIgdbDirect, ingestGameDirect } from './lib/ingest-pipeline.mjs';
import { rawgFetchJson } from './lib/rawg-client.mjs';
import { selectEssentialDiscoveryGames } from './lib/essential-discovery.mjs';
import { isPublicRawgContentAllowed } from '../src/lib/utils/public-safety.mjs';

const mode = process.argv[2];
const jobs = { upcoming: 'refresh-upcoming-snapshot', popular: 'discover-steam-popular', deep: 'discover-games-deep' };
const job = jobs[mode];
if (!job) throw new Error('Expected upcoming, popular, or deep mode');
const sql = connectDb(job);
const lock = mode === 'upcoming' ? job : 'games-ingest';

async function steamJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error' });
  if (!response.ok) throw new Error(`Steam HTTP ${response.status}`);
  return response.json();
}

async function discoverPopular(cursor) {
  const chartUrl = new URL('https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/');
  if (process.env.STEAM_API_KEY) chartUrl.searchParams.set('key', process.env.STEAM_API_KEY);
  const chart = await steamJson(chartUrl);
  if (!Array.isArray(chart?.response?.ranks)) throw new Error('Steam Charts response is incomplete');
  const ids = [...new Set(chart.response.ranks.slice(0, 100).map(row => row.appid)
    .filter(id => Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647))];
  if (!ids.length) throw new Error('Steam Charts returned no valid identities');
  const existing = await sql`SELECT steam_app_id FROM public.games WHERE steam_app_id = ANY(${ids}::bigint[])`;
  const known = new Set(existing.map(row => Number(row.steam_app_id)));
  const missing = ids.filter(id => !known.has(id));
  const start = Math.max(0, missing.indexOf(cursor) + 1) % (missing.length || 1);
  const selected = [...missing.slice(start), ...missing.slice(0, start)].slice(0, 3);
  let created = 0;
  let failed = 0;
  for (const appId of selected) {
    try {
      const details = await steamJson(`https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic`);
      const game = details[appId]?.data;
      if (game?.steam_appid !== appId || game.type !== 'game' || !game.name) { failed++; continue; }
      const result = await ingestGameDirect(sql, game.name, { expectedSteamAppId: appId });
      if (!result.success) failed++;
      else if (!result.alreadyExisted) created++;
    } catch (error) {
      if (isInfrastructureDbError(error)) throw error;
      failed++;
    }
  }
  return { scanned: ids.length, attempted: selected.length, created, failed, cursor: selected.at(-1) ?? null };
}

async function discoverDeep(cursor) {
  const page = Number.isSafeInteger(cursor) && cursor > 0 && cursor <= 100 ? cursor : 1;
  const data = await rawgFetchJson('/games', {
    attempts: 2, timeoutMs: 8000,
    params: { page, page_size: 40, ordering: '-metacritic', metacritic: '70,100', exclude_additions: true },
  });
  if (!Array.isArray(data.results)) throw new Error('Deep discovery response is incomplete');
  const eligible = data.results.slice(0, 40).filter(row =>
    row.slug && row.name && row.ratings_count >= 10 && isPublicRawgContentAllowed(row));
  const selected = (await selectEssentialDiscoveryGames(sql, eligible)).slice(0, 4);
  let created = 0;
  let failed = 0;
  for (const game of selected) {
    const result = await ingestGameDirect(sql, game.name, { expectedSlug: game.slug, expectedRawgId: game.id });
    if (!result.success) failed++;
    else if (!result.alreadyExisted) created++;
  }
  // Revisit a partially processed page so the cap does not drop its remaining games.
  const next = selected.length === 4 && created > 0 && !failed ? page : data.next && page < 100 ? page + 1 : 1;
  return { scanned: data.results.length, attempted: selected.length, created, failed, cursor: next };
}

let locked = false;
let run;
try {
  locked = await acquireLock(sql, lock);
  if (locked) {
    run = await startRun(sql, job);
    if (mode === 'upcoming') {
      const count = await refreshDiscoverySnapshot(sql);
      await finishRun(sql, run.id, { rows_scanned: count, rows_updated: 1, metadata: { snapshot_rows: count }, strict: true });
    } else if (mode === 'deep' && process.env.DISCOVERY_PROVIDER === 'igdb') {
      const fallback = await discoverIgdbDirect(sql, { limit: 8 });
      await finishRun(sql, run.id, {
        rows_scanned: fallback.scanned, rows_created: fallback.created, rows_updated: fallback.updated,
        rows_skipped: fallback.skipped, metadata: fallback, outcome: 'deferred',
        error_message: 'RAWG deep discovery deferred after independent IGDB progress', strict: true,
      });
      console.warn('::warning title=RAWG deep discovery deferred::Independent IGDB progress was recorded.');
    } else {
      const [previous] = await sql`SELECT metadata FROM public.scheduler_runs WHERE job_name = ${job}
        AND metadata ? 'cursor' ORDER BY started_at DESC LIMIT 1`;
      const result = mode === 'popular' ? await discoverPopular(previous?.metadata?.cursor) : await discoverDeep(previous?.metadata?.cursor);
      const failed = result.attempted > 0 && result.failed === result.attempted;
      await finishRun(sql, run.id, {
        rows_scanned: result.scanned, rows_created: result.created, metadata: result,
        error_message: failed ? 'Every bounded discovery candidate was rejected' : null, strict: true,
      });
      if (failed) process.exitCode = 1;
    }
  }
} catch (error) {
  if (run) await finishRun(sql, run.id, { error_message: String(error.message).replace(/https?:\/\/\S+/g, '[url]') });
  console.error('Catalogue maintenance failed:', error.name);
  process.exitCode = 1;
} finally {
  if (locked) await releaseLock(sql, lock);
  await closeDb(sql, job);
}
