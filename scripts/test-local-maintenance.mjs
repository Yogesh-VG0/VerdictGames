import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { recordMaintenanceAttempt } from './lib/maintenance-due.mjs';
import { buildSeedHash, publishManagedList } from './lib/curated-publisher.mjs';

assert.equal(new URL(process.env.SUPABASE_DB_URL).hostname, '127.0.0.1');
const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1 });
const run = `local-${randomUUID()}`;
const fixtureGame = randomUUID();
const fixtureList = `maintenance-fixture-${randomUUID()}`;
const directory = mkdtempSync(path.join(tmpdir(), 'verdict-maintenance-'));
const preload = path.join(directory, 'outage.mjs');
const output = path.join(directory, 'outputs.txt');
const summary = path.join(directory, 'summary.txt');
writeFileSync(preload, "globalThis.fetch = async () => new Response('Provider unavailable', { status: Number(process.env.LOCAL_PROVIDER_STATUS ?? 522) });\n");
writeFileSync(output, '');
writeFileSync(summary, '');

function health(job, status = '522', independent = false, key = 'local-test-only') {
  return spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, 'scripts/check-rawg-availability.mjs', job], {
    encoding: 'utf8', timeout: 30_000,
    env: { ...process.env, RAWG_API_KEY: key, LOCAL_PROVIDER_STATUS: status,
      TWITCH_CLIENT_ID:independent?'local-only':'',TWITCH_CLIENT_SECRET:independent?'local-only':'',
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
  for(const job of ['discover-standard','discover-deep']) {
    for(const status of ['522','401']) {
      writeFileSync(output,'');
      assert.equal(health(job,status,true).status,0,'Configured independent discovery passes the RAWG outage gate');
      assert.match(readFileSync(output,'utf8'),/run_job=true/);
      assert.match(readFileSync(output,'utf8'),/discovery_provider=igdb/);
    }
  }
  writeFileSync(output,'');
  assert.equal(health('discover-standard','401',true,'').status,0,'Missing RAWG credentials still allow configured IGDB discovery');
  assert.match(readFileSync(output,'utf8'),/discovery_provider=igdb/);
  const after=await sql`SELECT count(*)::int n FROM scheduler_runs WHERE metadata->>'github_run_id'=${run}`;
  assert.equal(after[0].n,3,'Fallback gate leaves the single progress/outage record to the worker');
  console.log('PASS local provider-outage health check: two deferred attempts, third attempt alerts, no ingestion, Steam independent, permanent errors fail');

  const [permission] = await sql`SELECT has_table_privilege('anon', 'public.maintenance_item_due_state', 'SELECT') AS anon_read,
    has_table_privilege('authenticated', 'public.maintenance_item_due_state', 'UPDATE') AS user_write`;
  assert.equal(permission.anon_read, false);
  assert.equal(permission.user_write, false);
  await sql`INSERT INTO public.games (id, slug, title) VALUES (${fixtureGame}, ${fixtureList}, 'Local maintenance fixture')`;
  await recordMaintenanceAttempt(sql, 'app_store', fixtureGame, false, 35);
  await recordMaintenanceAttempt(sql, 'app_store', fixtureGame, false, 35);
  const [failure] = await sql`SELECT failures, next_attempt_at > now() + interval '47 hours' AS backed_off
    FROM public.maintenance_item_due_state WHERE game_id = ${fixtureGame}`;
  assert.deepEqual({ ...failure }, { failures: 2, backed_off: true });
  await recordMaintenanceAttempt(sql, 'app_store', fixtureGame, true, 35);
  const [success] = await sql`SELECT failures, next_attempt_at > now() + interval '34 days' AS scheduled
    FROM public.maintenance_item_due_state WHERE game_id = ${fixtureGame}`;
  assert.deepEqual({ ...success }, { failures: 0, scheduled: true });

  const blueprint = { slug: fixtureList, title: 'Managed fixture', tags: ['test'] };
  const publish = (definition, constrainedIds) => publishManagedList(sql, definition, {
    previewText: 'Local', bodyText: 'Local', coverImage: '', constrainedIds,
    seedHash: buildSeedHash({ ...definition, previewText: 'Local', bodyText: 'Local' }, constrainedIds),
  });
  assert.equal(await publish(blueprint, [fixtureGame]), 'created');
  assert.equal(await publish(blueprint, [fixtureGame]), 'unchanged');
  await assert.rejects(publish({ ...blueprint, title: 'Failed replacement' }, [randomUUID()]),
    error => error.code === '23503');
  const [saved] = await sql`SELECT l.title, i.game_id FROM public.lists l
    JOIN public.list_items i ON i.list_id = l.id WHERE l.slug = ${fixtureList}`;
  assert.deepEqual({ ...saved }, { title: blueprint.title, game_id: fixtureGame });
  await sql`UPDATE public.lists SET title = 'Manual override', updated_at = now() + interval '1 second'
    WHERE slug = ${fixtureList}`;
  assert.equal(await publish(blueprint, [fixtureGame]), 'preserved');
  console.log('PASS private due state, backoff, atomic curated rollback and manual override preservation');
} finally {
  await sql`DELETE FROM public.lists WHERE slug = ${fixtureList}`;
  await sql`DELETE FROM public.games WHERE id = ${fixtureGame}`;
  await sql`DELETE FROM scheduler_runs WHERE metadata::text LIKE ${`%${run}%`}`;
  await sql.end();
  for (const file of [preload, output, summary]) unlinkSync(file);
  rmdirSync(directory);
}
