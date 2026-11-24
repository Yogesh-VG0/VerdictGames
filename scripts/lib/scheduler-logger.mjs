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

import { readMaintenanceBudget } from './maintenance-provider-budget.mjs';

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

// Resource exhaustion needs backpressure, not retries or a permissive guard.
// 57014 is query cancellation (including the existing statement timeout): a
// maintenance worker must stop instead of continuing thousands of row writes.
export function isResourcePressureDbError(error) {
  const code = String(error?.code ?? "").toUpperCase();
  if (["ECHECKOUTTIMEOUT", "53300", "53200", "53100", "57014"].includes(code)) return true;
  return /maxclientsinsessionmode|max clients reached|too many clients|unable to check out connection from the pool|remaining connection slots|out of memory|canceling statement due to statement timeout/i.test(getErrorMessage(error));
}

export function isInfrastructureDbError(error) {
  if (isResourcePressureDbError(error)) return true;
  const code = String(error?.code ?? "").toUpperCase();
  const message = getErrorMessage(error);

  if ([
    "CONNECTION_CLOSED",
    "CONNECT_TIMEOUT",
    "CONNECTION_DESTROYED",
    "CONNECTION_ENDED",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EAI_AGAIN",
  ].includes(code)) {
    return true;
  }

  return /maxclientsinsessionmode|max clients reached|too many clients|connection (?:closed|destroyed|ended|refused|reset)|connect(?:ion)? timeout|auth_query secret check timed out|failed to connect to database|\{\s*:error\s*,\s*:timeout\s*\}/i.test(message);
}

/**
 * Retry transient connection failures with exponential backoff.
 * Capacity errors, statement timeouts and other SQL errors never retry.
 */
export async function retryInfrastructureDbOperation(operationName, operation, {
  attempts = 3,
  initialDelayMs = 2000,
} = {}) {
  const maxAttempts = Math.max(1, Math.trunc(attempts));
  const baseDelayMs = Math.max(0, initialDelayMs);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      if (isResourcePressureDbError(err) || !isInfrastructureDbError(err) || attempt === maxAttempts) throw err;

      const delayMs = baseDelayMs * (2 ** (attempt - 1));
      console.warn(`⚠ ${operationName} failed: ${getErrorMessage(err)}. Retrying in ${delayMs}ms (${attempt + 1}/${maxAttempts}).`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Try to acquire a Postgres advisory lock (non-blocking).
 * Returns true if lock acquired, false if another instance holds it.
 * Use this to prevent overlapping scheduler runs.
 */
export async function acquireLock(sql, jobName) {
  const lockId = jobNameToLockId(jobName);
  try {
    return await retryInfrastructureDbOperation(`Advisory lock check for ${jobName}`, async () => {
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
        throw err;
      }
    });
  } catch (err) {
    const message = getErrorMessage(err);
    if (isInfrastructureDbError(err)) {
      console.error(`❌ Advisory lock check failed: ${message}. Aborting this run.`);
      throw err;
    }
    console.error(`❌ Advisory lock check failed: ${message}. Aborting this run.`);
    throw err;
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
 * Use this to enforce a minimum interval independently of the external trigger.
 * Returns true if the job should run, false if it should skip.
 *
 * @param {object} sql - Postgres connection
 * @param {string} jobName - The job name to check
 * @param {number} minIntervalHours - Minimum hours between runs
 */
export async function checkMinInterval(sql, jobName, minIntervalHours) {
  try {
    const [row] = await retryInfrastructureDbOperation(`Interval check for ${jobName}`, () => sql`
        SELECT COALESCE(finished_at, started_at) AS completed_at FROM scheduler_runs
        WHERE job_name = ${jobName} AND status = 'success'
        ORDER BY COALESCE(finished_at, started_at) DESC LIMIT 1
      `);
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
      console.error(`❌ Interval check failed: ${message}. Aborting this run.`);
      throw err;
    }
    console.warn(`⚠ Interval check failed: ${message}. Proceeding anyway.`);
    return true;
  }
}

/**
 * Start a scheduler run. Returns { id } for the new run row.
 */
export async function startRun(sql, jobName, metadata = {}, { strict = false } = {}) {
  try {
    const [row] = await sql`
      INSERT INTO scheduler_runs (job_name, status, metadata)
      VALUES (${jobName}, 'running', ${metadata}::jsonb)
      RETURNING id, started_at
    `;
    return { id: row.id, startedAt: row.started_at };
  } catch (err) {
    if (strict) throw err;
    const message = getErrorMessage(err);
    if (isSchedulerRunsTableMissing(err)) {
      console.warn(`⚠ scheduler_runs logging failed (table may not exist): ${message}`);
    } else if (isInfrastructureDbError(err)) {
      console.error(`❌ scheduler_runs logging failed: ${message}. Aborting this run.`);
      throw err;
    } else {
      console.warn(`⚠ scheduler_runs logging failed: ${message}`);
    }
    return { id: null, startedAt: new Date().toISOString() };
  }
}

/**
 * Finish a scheduler run. Call with counters and/or error.
 * @param {*} sql
 * @param {string|null} runId
 * @param {{rows_scanned?: number, rows_created?: number, rows_updated?: number,
 * rows_skipped?: number, error_message?: string|null, metadata?: Record<string, unknown>|null,
 * outcome?: 'success'|'error'|'deferred'|null, strict?: boolean}} options
 */
export async function finishRun(sql, runId, {
  rows_scanned = 0,
  rows_created = 0,
  rows_updated = 0,
  rows_skipped = 0,
  error_message = null,
  metadata = null,
  outcome = null,
  strict = false,
} = {}) {
  if (!runId) return;

  if (outcome !== null && !['success', 'error', 'deferred'].includes(outcome)) throw new Error('Invalid scheduler outcome');
  const budget = readMaintenanceBudget();
  const exhausted = budget?.budget_exhausted.length > 0;
  const resolvedOutcome = outcome ?? (error_message ? 'error' : 'success');
  const status = exhausted && resolvedOutcome === 'success' ? 'deferred' : resolvedOutcome;
  const resolvedError = error_message ?? (exhausted ? 'Provider request budget exhausted; retry at the next scheduled window' : null);
  try {
    const metadataClause = budget ? { ...metadata, ...budget } : metadata ?? null;
    await retryInfrastructureDbOperation(`Finish scheduler run ${runId}`, () => sql`
        UPDATE scheduler_runs SET
          finished_at = now(),
          status = ${status},
          duration_ms = EXTRACT(EPOCH FROM (now() - started_at)) * 1000,
          rows_scanned = ${rows_scanned},
          rows_created = ${rows_created},
          rows_updated = ${rows_updated},
          rows_skipped = ${rows_skipped},
          error_message = ${resolvedError},
          metadata = COALESCE(${metadataClause}::jsonb, metadata)
        WHERE id = ${runId}
      `);
  } catch (err) {
    if (strict || isInfrastructureDbError(err)) throw err;
    console.warn(`⚠ scheduler_runs finish logging failed: ${getErrorMessage(err)}`);
  }
}
