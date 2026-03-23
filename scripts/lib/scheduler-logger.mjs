/**
 * Scheduler observability helper.
 * Records job runs to the scheduler_runs table for monitoring.
 *
 * Usage in scheduler scripts:
 *   import { startRun, finishRun } from './lib/scheduler-logger.mjs';
 *   const run = await startRun(sql, 'refresh-trending');
 *   // ... do work ...
 *   await finishRun(sql, run.id, { rows_scanned: 100, rows_updated: 5 });
 *   // or on error:
 *   await finishRun(sql, run.id, { error_message: err.message });
 */

/**
 * Start a scheduler run. Returns { id } for the new run row.
 */
export async function startRun(sql, jobName, metadata = {}) {
  try {
    const [row] = await sql`
      INSERT INTO scheduler_runs (job_name, status, metadata)
      VALUES (${jobName}, 'running', ${JSON.stringify(metadata)}::jsonb)
      RETURNING id, started_at
    `;
    return { id: row.id, startedAt: row.started_at };
  } catch (err) {
    // Table might not exist yet — gracefully degrade
    console.warn(`⚠ scheduler_runs logging failed (table may not exist): ${err.message}`);
    return { id: null, startedAt: new Date().toISOString() };
  }
}

/**
 * Finish a scheduler run. Call with counters and/or error.
 */
export async function finishRun(sql, runId, {
  rows_scanned = 0,
  rows_created = 0,
  rows_updated = 0,
  rows_skipped = 0,
  error_message = null,
  metadata = null,
} = {}) {
  if (!runId) return; // logging was skipped (table doesn't exist)

  const status = error_message ? 'error' : 'success';
  try {
    const metadataClause = metadata ? JSON.stringify(metadata) : null;
    await sql`
      UPDATE scheduler_runs SET
        finished_at = now(),
        status = ${status},
        duration_ms = EXTRACT(EPOCH FROM (now() - started_at)) * 1000,
        rows_scanned = ${rows_scanned},
        rows_created = ${rows_created},
        rows_updated = ${rows_updated},
        rows_skipped = ${rows_skipped},
        error_message = ${error_message},
        metadata = COALESCE(${metadataClause}::jsonb, metadata)
      WHERE id = ${runId}
    `;
  } catch (err) {
    console.warn(`⚠ scheduler_runs finish logging failed: ${err.message}`);
  }
}
