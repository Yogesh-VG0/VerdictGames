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
}
