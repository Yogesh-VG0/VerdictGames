// Replays app migrations and drills backup/restore in newly created databases
// inside the existing local Docker server. Never targets or resets its main DB.
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const endpoint = execFileSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], { encoding: 'utf8' }).trim();
assert.ok(endpoint.startsWith('npipe:') || endpoint.startsWith('unix:'), 'Replay requires a local Docker socket');
const container = 'supabase_db_Verdict_Games';
const id = randomBytes(6).toString('hex');
const replay = `verdict_replay_${id}`;
const restored = `verdict_restore_${id}`;
assert.ok([replay, restored].every(name => /^verdict_(replay|restore)_[a-f0-9]{12}$/.test(name)));
const created = [];
const output = path.resolve('.verification');
mkdirSync(output, { recursive: true });

function docker(args, input) {
  const result = spawnSync('docker', ['exec', '-i', container, ...args], { input, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Local ${args[0]} failed: ${result.stderr.slice(-2500)}`);
  return result.stdout;
}
function query(database, sql) {
  return docker(['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-At'], sql);
}
function createDatabase(name) {
  query('postgres', `CREATE DATABASE "${name}" TEMPLATE template0;`);
  created.push(name);
}
try {
  createDatabase(replay);
  let baseline = docker(['pg_dump', '-U', 'postgres', '-d', 'postgres', '--schema-only', '--no-owner', '--no-privileges', '--schema=auth', '--schema=storage']);
  // The app migration creates this trigger after its public handler exists.
  baseline = baseline.replace(/^CREATE TRIGGER [^\n]+EXECUTE FUNCTION public\.handle_new_user\(\);\r?$/gm, '');
  query(replay, 'CREATE SCHEMA extensions; CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;');
  query(replay, baseline);
  const managedHelper = query('postgres', "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='rls_auto_enable';");
  if (managedHelper.trim()) query(replay, managedHelper);
  // Supabase's managed baseline grants new public tables before app migrations
  // tighten privileges. Reproduce those defaults only inside this new test DB.
  query(replay, `GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA storage TO service_role;
    GRANT SELECT ON storage.objects TO anon;
    GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;`);
  const files = readdirSync('supabase/migrations').filter(file => file.endsWith('.sql')).sort();
  const migrations = [];
  for (const file of files) {
    const source = readFileSync(path.join('supabase/migrations', file), 'utf8');
    try { query(replay, `SET search_path=public,extensions;\n${source}`); }
    catch (error) { throw new Error(`Migration ${file}: ${error.message}`); }
    migrations.push({ file, sha256: createHash('sha256').update(source).digest('hex') });
  }
  const permissions = query(replay, "SELECT has_column_privilege('anon','public.profiles','role','SELECT'),has_table_privilege('anon','public.user_games','SELECT');").trim();
  assert.equal(permissions, 'f|f', 'Replayed privacy boundary must match intended state');
  const catalogueChecks=query(replay, `BEGIN;
    INSERT INTO public.games(slug,title,release_date,review_count,score,verdict_score,confidence,genres,platforms,tags,steam_app_id) VALUES
      ('a-tie','Synthetic Tie A','2025-01-01',5000,94,94,1,ARRAY['Action'],ARRAY['PC'],'{}',NULL),
      ('b-tie','Synthetic Tie B','2025-01-01',5000,95,95,0.92,ARRAY['Action'],ARRAY['PC'],'{}',NULL),
      ('low-evidence','Synthetic Low Evidence','2025-01-01',99,100,100,1,ARRAY['Action'],ARRAY['PC'],'{}',NULL),
      ('early','Synthetic Early Access','2025-01-01',9000,100,100,1,ARRAY['Action'],ARRAY['PC'],ARRAY['Early Access'],NULL),
      ('unsafe','Synthetic Unsafe','2025-01-01',9000,100,100,1,ARRAY['Action'],ARRAY['PC'],ARRAY['NSFW'],NULL),
      ('addon','Synthetic Season Pass','2025-01-01',9000,100,100,1,ARRAY['Action'],ARRAY['PC'],'{}',NULL),
      ('a-hidden','Synthetic RLS Hidden','2025-01-01',9000,100,100,1,ARRAY['Action'],ARRAY['PC'],'{}',NULL),
      ('steam-poor','Synthetic Steam A','2025-01-01',5000,88,88,1,ARRAY['Action'],ARRAY['PC'],'{}',5010101),
      ('steam-best','Synthetic Steam B','2025-01-01',5000,91,91,1,ARRAY['Action'],ARRAY['PlayStation 5'],'{}',5010101);
    CREATE POLICY catalogue_fixture_guard ON public.games AS RESTRICTIVE FOR SELECT TO anon USING (slug <> 'a-hidden');
    SET LOCAL ROLE anon;
    SELECT public.explore_catalogue_page('all-time',0,'','','default',1,40,'2026-11-15');
    SELECT public.explore_catalogue_page('all-time',0,'','PlayStation 5','default',1,40,'2026-11-15');
    ROLLBACK;`).split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
  assert.equal(catalogueChecks[0].count,3,'SQL catalogue applies safety/eligibility/canonical filters and caller RLS');
  assert.deepEqual(catalogueChecks[0].rows.map(row=>row.slug),['a-tie','b-tie','steam-best'],'SQL preserves serialized-float ranking ties and canonical representative preference');
  assert.deepEqual(catalogueChecks[1].rows.map(row=>row.rank),[3],'Platform filtering retains absolute Top 250 rank');
  assert.ok(!JSON.stringify(catalogueChecks).includes('description'),'SQL transfers card fields only after pagination');
  console.log('PASS SQL catalogue eligibility, exact score ties, canonical deduplication, absolute platform ranks and invoker RLS');
  query(replay, "CREATE TABLE public.recovery_fixture(id int primary key,payload text); INSERT INTO public.recovery_fixture VALUES(1,'synthetic restore verification');");
  const dump = spawnSync('docker', ['exec', container, 'pg_dump', '-U', 'postgres', '-d', replay, '--format=custom', '--no-owner'], { maxBuffer: 20 * 1024 * 1024 });
  assert.equal(dump.status, 0, 'Synthetic backup export must succeed');
  createDatabase(restored);
  const restore = spawnSync('docker', ['exec', '-i', container, 'pg_restore', '-U', 'postgres', '-d', restored, '--no-owner', '--exit-on-error'], { input: dump.stdout, maxBuffer: 20 * 1024 * 1024 });
  if (restore.status !== 0) throw new Error(`Local restore failed: ${restore.stderr.toString().slice(-2500)}`);
  assert.equal(query(restored, 'SELECT payload FROM public.recovery_fixture WHERE id=1;').trim(), 'synthetic restore verification');
  assert.equal(query(restored, "SELECT has_column_privilege('anon','public.profiles','role','SELECT'),has_table_privilege('anon','public.user_games','SELECT');").trim(), permissions);
  writeFileSync(path.join(output, 'migration-replay.json'), JSON.stringify({ migrations, restore: 'passed', privatePrivileges: 'passed', backupBytes: dump.stdout.length }, null, 2));
  console.log(`PASS ${files.length} migrations replayed; synthetic backup restored with data and private privileges intact`);
} finally {
  for (const name of created.reverse()) {
    // Names come exclusively from the validated generated list above.
    query('postgres', `DROP DATABASE "${name}" WITH (FORCE);`);
  }
}
