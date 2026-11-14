#!/usr/bin/env node

import { appendFileSync } from "node:fs";
import { isRetryableRawgError, rawgFetchJson } from "./lib/rawg-client.mjs";

const job = process.argv[2] ?? "";
const rawgOnlyJobs = new Set([
  "re-enrich",
  "discover-standard",
  "discover-deep",
  "backfill-games",
]);

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

function addSummary(message) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
  }
}

if (!rawgOnlyJobs.has(job)) {
  setOutput("run_job", "true");
  process.exit(0);
}

try {
  await rawgFetchJson("/games", {
    params: { page_size: 1 },
    attempts: 2,
    timeoutMs: 25_000,
  });
  console.log("RAWG health check passed.");
  setOutput("run_job", "true");
} catch (error) {
  if (!isRetryableRawgError(error)) {
    console.error(`RAWG health check failed with a non-retryable error: ${error.message}`);
    process.exit(1);
  }

  const message = `RAWG is temporarily unavailable (${error.message}); deferring ${job} until its next schedule.`;
  console.warn(`::warning title=RAWG temporarily unavailable::${message}`);
  addSummary(`### Deferred \`${job}\``);
  addSummary(message);
  setOutput("run_job", "false");
  setOutput("outcome", "deferred");
  // A deferred run is not successful maintenance. Persist the reason so the
  // dashboard can distinguish provider outages from a dead scheduler.
  const { connectDb, closeDb } = await import('./lib/db-connect.mjs');
  const { startRun, finishRun } = await import('./lib/scheduler-logger.mjs');
  const jobName = job === 'discover-standard' ? 'discover-games' : job === 'discover-deep' ? 'discover-games-deep' : job;
  const sql = connectDb(jobName);
  try {
    const metadata = { outcome: 'deferred', provider: 'rawg', github_run_id: process.env.GITHUB_RUN_ID ?? null };
    const run = await startRun(sql, jobName, metadata, { strict: true });
    await finishRun(sql, run.id, { outcome: 'deferred', strict: true,
      error_message: `Deferred: ${message}`, metadata });
    const recent = await sql`SELECT status FROM scheduler_runs WHERE job_name = ${jobName}
      ORDER BY started_at DESC LIMIT 3`;
    const repeated = recent.length === 3 && recent.every(row => row.status === 'deferred');
    addSummary('No ingestion ran. This is a deferred attempt, not completed maintenance.');
    if (repeated) {
      console.error('::error title=Repeated maintenance deferral::Three consecutive attempts were deferred. Check provider availability and last successful maintenance.');
      process.exitCode = 1;
    }
  } finally { await closeDb(sql, jobName); }
}
