import { appendFileSync } from 'node:fs';
import { connectDb, closeDb } from './lib/db-connect.mjs';

const expectations = {
  'refresh-trending': 18,
  're-enrich': 36,
  'discover-games': 36,
  'discover-steam-popular': 36,
  'discover-games-deep': 24 * 9,
  'backfill-games': 24 * 9,
};
if (process.env.CATALOGUE_UPCOMING_CRON_ENABLED === 'true') expectations['refresh-upcoming-snapshot'] = 12;
if (process.env.CATALOGUE_PLAYER_CRON_ENABLED === 'true') expectations['refresh-player-counts'] = 4;
if (process.env.CATALOGUE_REVIEW_CRON_ENABLED === 'true') expectations['refresh-steam-reviews'] = 24 * 6;
if (process.env.CATALOGUE_CURATED_CRON_ENABLED === 'true') expectations['seed-curated-lists'] = 24 * 9;
if (process.env.CATALOGUE_MOBILE_CRON_ENABLED === 'true') {
  expectations['backfill-mobile-android'] = 24 * 9;
  expectations['backfill-mobile-ios'] = 24 * 9;
}
const sql = connectDb('maintenance-health');
try {
  const rows = await sql`
    SELECT job_name, max(finished_at) FILTER (WHERE status = 'success') AS last_success,
      max(finished_at) FILTER (WHERE status IN ('error', 'deferred')) AS last_problem
    FROM public.scheduler_runs
    WHERE job_name = ANY(${Object.keys(expectations)}::text[]) AND started_at >= now() - interval '10 days'
    GROUP BY job_name
  `;
  const summary = ['| Worker | Last success (UTC) | Last failure or deferral (UTC) |', '| --- | --- | --- |'];
  const stale = [];
  for (const [job, hours] of Object.entries(expectations)) {
    const row = rows.find(item => item.job_name === job);
    const last = row?.last_success;
    if (!last || Date.now() - new Date(last).getTime() > hours * 3_600_000) stale.push(job);
    summary.push(`| ${job} | ${last?.toISOString() ?? 'Unavailable'} | ${row?.last_problem?.toISOString() ?? '-'} |`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
  if (stale.length) {
    console.error(`::error title=Catalogue maintenance freshness review::Overdue workers: ${stale.join(', ')}`);
    process.exitCode = 1;
  }
} finally {
  await closeDb(sql, 'maintenance-health');
}
