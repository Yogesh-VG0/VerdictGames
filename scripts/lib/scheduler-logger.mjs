/**
 * Scheduler observability + anti-overlap helper.
 * Records job runs to the scheduler_runs table for monitoring.
 * Provides Postgres advisory locks to prevent overlapping runs.
 *
 * Usage in scheduler scripts:
 *   import { startRun, finishRun, acquireLock, releaseLock } from './lib/scheduler-logger.mjs';
 *   const locked = await acquireLock(sql, 'refresh-trending');
 *   if (!locked) { console.log('Another instance running, skipping'); process.exit(0); }
 *   const run = await startRun(sql, 'refresh-trending');
 *   // ... do work ...
 *   await finishRun(sql, run.id, { rows_scanned: 100, rows_updated: 5 });
 *   await releaseLock(sql, 'refresh-trending');
 */

// Stable hash for advisory lock keys (Postgres advisory locks use bigint keys)
function jobNameToLockId(jobName) {
  let hash = 0;
  for (let i = 0; i < jobName.length; i++) {
    hash = ((hash << 5) - hash + jobName.charCodeAt(i)) | 0;
  }
  // Use a namespace prefix (0xVG = 86, 71) to avoid collisions with other lock users
  return Math.abs(hash) + 86710000;
}

const reservedLocks = new WeakMap();

function getLockStore(sql) {
  let store = reservedLocks.get(sql);
  if (!store) {
    store = new Map();
    reservedLocks.set(sql, store);
  }
  return store;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function isSchedulerRunsTableMissing(error) {
  const code = String(error?.code ?? "").toUpperCase();
  const message = getErrorMessage(error);
  return code === "42P01" || /relation\s+['\"]?scheduler_runs['\"]?\s+does not exist/i.test(message);
}

function isInfrastructureDbError(error) {
  const code = String(error?.code ?? "").toUpperCase();
  const message = getErrorMessage(error);

  if (["CONNECTION_CLOSED", "CONNECT_TIMEOUT", "CONNECTION_DESTROYED", "CONNECTION_ENDED"].includes(code)) {
    return true;
  }

  return /maxclientsinsessionmode|max clients reached|too many clients|connection closed|connection destroyed|connection ended|connect timeout/i.test(message);
}

/**
 * Try to acquire a Postgres advisory lock (non-blocking).
 * Returns true if lock acquired, false if another instance holds it.
 * Use this to prevent overlapping scheduler runs.
 */
export async function acquireLock(sql, jobName) {
  const lockId = jobNameToLockId(jobName);
  let reserved = null;
  try {
    reserved = await sql.reserve();
    const [{ acquired }] = await reserved`SELECT pg_try_advisory_lock(${lockId}) AS acquired`;
    if (!acquired) {
      reserved.release();
      console.log(`🔒 Advisory lock ${lockId} (${jobName}) already held — another instance is running. Skipping.`);
      return false;
    }
    getLockStore(sql).set(jobName, reserved);
    return true;
  } catch (err) {
    if (reserved) {
      try { reserved.release(); } catch {}
    }
    const message = getErrorMessage(err);
    if (isInfrastructureDbError(err)) {
      console.warn(`⚠ Advisory lock check failed: ${message}. Skipping this run to avoid overlap while DB capacity is degraded.`);
      return false;
    }
    console.warn(`⚠ Advisory lock check failed: ${message}. Proceeding without advisory lock.`);
    return true;
  }
}

/**
 * Release a previously acquired advisory lock.
 */
export async function releaseLock(sql, jobName) {
  const lockId = jobNameToLockId(jobName);
  const store = reservedLocks.get(sql);
  const reserved = store?.get(jobName);
  if (!reserved) return;
  try {
    const [{ released }] = await reserved`SELECT pg_advisory_unlock(${lockId}) AS released`;
    if (!released) {
      console.warn(`⚠ Advisory lock ${lockId} (${jobName}) was not held during release.`);
    }
  } catch (err) {
    console.warn(`⚠ Advisory lock release failed: ${err.message}`);
  } finally {
    store.delete(jobName);
    if (store.size === 0) {
      reservedLocks.delete(sql);
    }
    try { reserved.release(); } catch {}
  }
}

/**
 * Check if enough time has passed since the last successful run.
 * Use this to implement "every N hours" with Heroku Scheduler's hourly trigger.
 * Returns true if the job should run, false if it should skip.
 *
 * @param {object} sql - Postgres connection
 * @param {string} jobName - The job name to check
 * @param {number} minIntervalHours - Minimum hours between runs
 */
export async function checkMinInterval(sql, jobName, minIntervalHours) {
  try {
    const [row] = await sql`
      SELECT COALESCE(finished_at, started_at) AS completed_at FROM scheduler_runs
      WHERE job_name = ${jobName} AND status = 'success'
      ORDER BY COALESCE(finished_at, started_at) DESC LIMIT 1
    `;
    if (!row) return true; // no previous run found, should run

    const lastRun = new Date(row.completed_at);
    const hoursSince = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60);

    if (hoursSince < minIntervalHours) {
      console.log(`⏭ Skipping ${jobName}: last successful run was ${hoursSince.toFixed(1)}h ago (min interval: ${minIntervalHours}h)`);
      return false;
    }
    return true;
  } catch (err) {
    const message = getErrorMessage(err);
    if (isSchedulerRunsTableMissing(err)) {
      console.warn(`⚠ Interval check failed: ${message}. Proceeding without interval guard.`);
      return true;
    }
    if (isInfrastructureDbError(err)) {
      console.warn(`⚠ Interval check failed: ${message}. Skipping this run because DB capacity is degraded.`);
      return false;
    }
    console.warn(`⚠ Interval check failed: ${message}. Proceeding anyway.`);
    return true;
  }
}

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
    const message = getErrorMessage(err);
    if (isSchedulerRunsTableMissing(err)) {
      console.warn(`⚠ scheduler_runs logging failed (table may not exist): ${message}`);
    } else {
      console.warn(`⚠ scheduler_runs logging failed: ${message}`);
    }
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
  if (!runId) return;

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
    console.warn(`⚠ scheduler_runs finish logging failed: ${getErrorMessage(err)}`);
  }
}
