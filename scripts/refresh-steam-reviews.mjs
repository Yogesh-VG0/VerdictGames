import { connectDb, closeDb } from './lib/db-connect.mjs';
import { acquireLock, releaseLock, startRun, finishRun } from './lib/scheduler-logger.mjs';
import { fetchSteamReviews } from '../src/lib/external/steam-reviews-api.mjs';
import { pathToFileURL } from 'node:url';

const integer = value => Math.max(0, Math.trunc(Number(value) || 0));
const timestamp = value => Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;

export async function refreshReviewBatch(sql, { limit = 500, pauseMs = 1000 } = {}) {
  const games = await sql`
    SELECT g.id, g.steam_app_id FROM public.games g
    LEFT JOIN public.steam_review_refresh_state s ON s.game_id = g.id
    WHERE g.steam_app_id > 0 AND (s.next_attempt_at IS NULL OR s.next_attempt_at <= now())
    ORDER BY s.last_success_at ASC NULLS FIRST, g.trending DESC, g.review_count DESC
    LIMIT ${Math.max(1, Math.min(1000, limit))}
  `;
  const stats = { scanned: 0, refreshed: 0, failed: 0 };
  for (const game of games) {
    stats.scanned++;
    try {
      const payload = await fetchSteamReviews(game.steam_app_id, { languages: ['english'], limit: 21 });
      const fetchedAt = new Date().toISOString();
      const reviews = payload.reviews.filter(r => typeof r.recommendationid === 'string' && typeof r.review === 'string' && r.review.trim())
        .map(r => ({ game_id: game.id, steam_app_id: game.steam_app_id, recommendation_id: r.recommendationid,
          language: r.language || 'english', voted_up: Boolean(r.voted_up), review_text: r.review.trim(),
          playtime_at_review: integer(r.author?.playtime_at_review), playtime_forever: integer(r.author?.playtime_forever),
          author_steam_id: r.author?.steamid ?? null, author_playtime_forever: integer(r.author?.playtime_forever),
          authored_at: timestamp(r.timestamp_created), updated_at: timestamp(r.timestamp_updated),
          votes_up: integer(r.votes_up), votes_funny: integer(r.votes_funny), weighted_vote_score: Number(r.weighted_vote_score) || 0,
          steam_purchase: Boolean(r.steam_purchase), received_for_free: Boolean(r.received_for_free), fetched_at: fetchedAt }));
      // Both statements and the refresh marker commit together. A failed insert
      // rolls back deletion, preserving the last known good snapshot.
      await sql.begin(async tx => {
        await tx`DELETE FROM public.steam_reviews WHERE game_id = ${game.id}`;
        if (reviews.length) await tx`INSERT INTO public.steam_reviews ${tx(reviews)}`;
        await tx`INSERT INTO public.steam_review_refresh_state (game_id, attempted_at, next_attempt_at, last_success_at, failures)
          VALUES (${game.id}, now(), now() + interval '72 hours', now(), 0)
          ON CONFLICT (game_id) DO UPDATE SET attempted_at = now(), next_attempt_at = now() + interval '72 hours', last_success_at = now(), failures = 0`;
      });
      stats.refreshed++;
    } catch (error) {
      stats.failed++;
      await sql`INSERT INTO public.steam_review_refresh_state (game_id, attempted_at, next_attempt_at, failures)
        VALUES (${game.id}, now(), now() + interval '1 hour', 1)
        ON CONFLICT (game_id) DO UPDATE SET attempted_at = now(), failures = steam_review_refresh_state.failures + 1,
          next_attempt_at = now() + least(24, power(2, least(steam_review_refresh_state.failures, 5))) * interval '1 hour'`;
      console.warn(`Steam review refresh failed (${stats.failed}): ${error.message}`);
      // A provider outage must not fan out across hundreds of games.
      if (stats.failed >= 3) break;
    }
    if (pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs));
  }
  return stats;
}

async function main() {
  const sql = connectDb('refresh-steam-reviews');
  let locked = false;
  let run;
  try {
    locked = await acquireLock(sql, 'refresh-steam-reviews');
    if (!locked) return;
    run = await startRun(sql, 'refresh-steam-reviews');
    const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
    const stats = await refreshReviewBatch(sql, { limit: limitArg ? integer(limitArg.split('=')[1]) : integer(process.env.STEAM_REVIEW_LIMIT || 500) });
    const error = stats.failed ? `${stats.failed} Steam refreshes failed; remaining work deferred` : null;
    await finishRun(sql, run.id, { rows_scanned: stats.scanned, rows_updated: stats.refreshed, error_message: error, metadata: stats });
    console.log(JSON.stringify(stats));
    if (error) process.exitCode = 1;
  } catch (error) {
    if (run) await finishRun(sql, run.id, { error_message: error.message });
    throw error;
  } finally {
    if (locked) await releaseLock(sql, 'refresh-steam-reviews');
    await closeDb(sql, 'refresh-steam-reviews');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
