import { appendFileSync } from 'node:fs';
import { connectDb, closeDb } from './lib/db-connect.mjs';

const lowerPriority = new Set([
  'seed-curated-lists', 'refresh-steam-reviews', 'backfill-mobile-android', 'backfill-mobile-ios',
  'discover-steam-popular', 'discover-deep', 'backfill-games',
]);
const job = process.argv[2];
let ready = true;
if (lowerPriority.has(job)) {
  const sql = connectDb('maintenance-pressure');
  try {
    const [health] = await sql`
      SELECT EXISTS (
        SELECT 1 FROM public.scheduler_runs WHERE started_at > now() - interval '2 hours'
        AND status = 'error' AND error_message ~* 'statement timeout|out of memory|too many clients|maxclients|connection.*timeout'
      ) AS recent_pressure,
      (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
        AND pid <> pg_backend_pid() AND state = 'active') AS active,
      current_setting('max_connections')::int AS capacity
    `;
    // Direct indicators only. This probe cannot infer host-wide paging.
    ready = !health.recent_pressure && Number(health.active) < Number(health.capacity) / 2;
  } catch {
    ready = false;
  } finally {
    await closeDb(sql, 'maintenance-pressure');
  }
}
if (!ready) {
  console.warn(`::warning title=Maintenance deferred::${job} will retry on its next scheduled window after database pressure clears.`);
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\nDeferred ${job}: database pressure or unavailable health check. No worker ran.\n`);
}
appendFileSync(process.env.GITHUB_OUTPUT, `run_job=${ready}\n`);
