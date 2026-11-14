import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';

assert.equal(new URL(process.env.SUPABASE_DB_URL).hostname, '127.0.0.1');
const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1 });
const run = `local-${randomUUID()}`;
const directory = mkdtempSync(path.join(tmpdir(), 'verdict-maintenance-'));
const preload = path.join(directory, 'outage.mjs');
const output = path.join(directory, 'outputs.txt');
const summary = path.join(directory, 'summary.txt');
writeFileSync(preload, "globalThis.fetch = async () => new Response('Provider unavailable', { status: Number(process.env.LOCAL_PROVIDER_STATUS ?? 522) });\n");
writeFileSync(output, '');
writeFileSync(summary, '');

function health(job, status = '522') {
  return spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, 'scripts/check-rawg-availability.mjs', job], {
    encoding: 'utf8', timeout: 30_000,
    env: { ...process.env, RAWG_API_KEY: 'local-test-only', LOCAL_PROVIDER_STATUS: status,
      GITHUB_RUN_ID: run, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary },
  });
}
try {
  const candidates = [['re-enrich', 're-enrich'], ['discover-standard', 'discover-games'],
    ['discover-deep', 'discover-games-deep'], ['backfill-games', 'backfill-games']];
  let selected;
  for (const candidate of candidates) {
    const [count] = await sql`SELECT count(*)::int n FROM scheduler_runs WHERE job_name = ${candidate[1]}`;
    if (count.n === 0) { selected = candidate; break; }
  }
  assert.ok(selected, 'Use a local job without existing history; never delete existing runs for a test');
  const results = [health(selected[0]), health(selected[0]), health(selected[0])];
  assert.deepEqual(results.map(result => result.status), [0, 0, 1], 'Repeated deferrals must surface an actionable workflow failure');
  assert.ok(results[2].stderr.includes('Three consecutive attempts were deferred'));
  const rows = await sql`SELECT status FROM scheduler_runs WHERE metadata->>'github_run_id' = ${run}`;
  assert.equal(rows.length, 3);
  assert.ok(rows.every(row => row.status === 'deferred'));
  assert.ok(readFileSync(output, 'utf8').includes('run_job=false'));
  assert.ok(readFileSync(summary, 'utf8').includes('not completed maintenance'));
  assert.equal(health('refresh-trending').status, 0, 'Steam maintenance stays independent from RAWG outage gating');
  assert.equal(health(selected[0], '401').status, 1, 'Non-retryable provider/config errors remain failures');
  console.log('PASS local provider-outage health check: two deferred attempts, third attempt alerts, no ingestion, Steam independent, permanent errors fail');
} finally {
  await sql`DELETE FROM scheduler_runs WHERE metadata::text LIKE ${`%${run}%`}`;
  await sql.end();
  for (const file of [preload, output, summary]) unlinkSync(file);
  rmdirSync(directory);
}
