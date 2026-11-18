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
    if(file.endsWith('_distinguish_mature_from_adult_only.sql')) query(replay,`INSERT INTO public.games(slug,title,release_date,review_count,score,tags,updated_at) VALUES
      ('policy-mature','Mainstream Mature Game','2020-01-01',1000,90,ARRAY['Nudity','Sexual Content','18+'],'2001-01-01'),
      ('policy-explicit','Hentai Clicker','2020-01-01',1000,99,ARRAY['Action'],'2001-01-01');`);
    if(file.endsWith('_cache_explore_classification.sql')) query(replay, `INSERT INTO public.games(slug,title,release_date,review_count,score,updated_at) VALUES
      ('preclass-a','Preclassification A','2020-01-01',1000,90,'2001-01-01'),
      ('preclass-b','Preclassification B','2020-01-01',1000,91,'2001-01-01');`);
    const source = readFileSync(path.join('supabase/migrations', file), 'utf8');
    try { query(replay, `SET search_path=public,extensions;\n${source}`); }
    catch (error) { throw new Error(`Migration ${file}: ${error.message}`); }
    migrations.push({ file, sha256: createHash('sha256').update(source).digest('hex') });
    if(file.endsWith('_distinguish_mature_from_adult_only.sql')) {
      execFileSync(process.execPath,['scripts/refresh-public-safety.mjs','--database='+replay,'--evidence-path=.verification/replay-safety-policy.json'],{stdio:['ignore','pipe','pipe']});
      const policy=JSON.parse(readFileSync('.verification/replay-safety-policy.json','utf8'));
      assert.equal(policy.updated,2);assert.equal(policy.remaining,0);assert.equal(policy.sourceValuesPreserved,true);
      assert.equal(query(replay,"SELECT string_agg(slug || ':' || explore_primary_safe::text,',' ORDER BY slug) FROM public.games WHERE slug LIKE 'policy-%';").trim(),'policy-explicit:false,policy-mature:true');
      query(replay,"DELETE FROM public.games WHERE slug LIKE 'policy-%';");
      console.log('PASS changed-row-only mature/adult policy refresh preserves all source fields and projection maintenance');
    }
    if(file.endsWith('_cache_explore_classification.sql')) {
      assert.equal(query(replay,"SELECT count(*) FROM public.games WHERE explore_primary_safe IS NULL;").trim(),'2');
      const unfilled=query(replay,"SET ROLE anon; SELECT public.explore_catalogue_page('all-time',0,'','','default',1,40,'2026-11-15'); RESET ROLE;").split('\n').find(line=>line.startsWith('{'));
      assert.equal(JSON.parse(unfilled).count,2,'Unfilled derived fields retain accurate live classification');
      execFileSync(process.execPath,['scripts/backfill-explore-classification.mjs','--database='+replay,'--evidence-path=.verification/replay-classification-backfill.json'],{stdio:['ignore','pipe','pipe']});
      const backfill=JSON.parse(readFileSync('.verification/replay-classification-backfill.json','utf8'));
      assert.equal(backfill.updated,2);assert.equal(backfill.remaining,0);assert.equal(backfill.allSourceValuesPreserved,true);
    }
  }
  const permissions = query(replay, "SELECT has_column_privilege('anon','public.profiles','role','SELECT'),has_table_privilege('anon','public.user_games','SELECT');").trim();
  assert.equal(permissions, 'f|f', 'Replayed privacy boundary must match intended state');
  assert.equal(query(replay,"SELECT count(*) FROM public.games WHERE explore_primary_safe IS NULL;").trim(),'0');
  const fallback=query(replay,"SET ROLE anon; SELECT public.explore_catalogue_page('all-time',0,'','','default',1,40,'2026-11-15'); RESET ROLE;")
    .split('\n').find(line=>line.startsWith('{'));
  assert.equal(JSON.parse(fallback).count,2,'Unready compact projection uses the accurate source fallback');
  execFileSync(process.execPath,['scripts/test-explore-inputs.mjs','--database='+replay],{stdio:['ignore','pipe','pipe']});
  assert.equal(query(replay,"SELECT count(*) FROM public.games WHERE updated_at='2001-01-01'::timestamptz;").trim(),'2','Derived-only backfill preserves existing freshness timestamps');
  query(replay,"DELETE FROM public.games WHERE slug IN ('preclass-a','preclass-b');");
  console.log('PASS staged classification fallback and actual CLI backfill preserve all source fields');
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
  const storedChecks=query(replay, `BEGIN;
    INSERT INTO public.games(slug,title,release_date,review_count,verdict_score,confidence,steam_app_id) VALUES
      ('year-a','Synthetic Solo (2022)','2022-01-01',1000,90,1,5010111),
      ('year-b','Synthetic Solo (2023)','2023-01-01',1000,95,1,5010222);
    SET LOCAL ROLE anon;
    SELECT public.explore_catalogue_page('all-time',0,'','','default',1,40,'2026-11-15');
    RESET ROLE;
    UPDATE public.games SET description='nsfw' WHERE slug IN ('year-a','year-b');
    SET LOCAL ROLE anon;
    SELECT public.explore_catalogue_page('all-time',0,'','','default',1,40,'2026-11-15');
    RESET ROLE;
    UPDATE public.games SET description='',tags=ARRAY['Early Access'] WHERE slug='year-a';
    SET LOCAL ROLE anon;
    SELECT public.explore_catalogue_page('all-time',0,'','','default',1,40,'2026-11-15');
    SELECT public.explore_catalogue_page('best-of-year',0,'','','default',1,40,'2026-11-15');
    ROLLBACK;`).split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
  assert.equal(storedChecks[0].count,1,'Unpaired year-suffixed Steam records retain the existing title canonical group');
  assert.equal(storedChecks[0].rows[0].slug,'year-b');
  assert.equal(storedChecks[1].count,0,'Description edits immediately recompute stored safety');
  assert.equal(storedChecks[2].count,0,'Tag edits immediately recompute Early Access exclusion');
  assert.equal(storedChecks[3].count,1,'Stored classification preserves catalogue upcoming fallback');
  console.log('PASS stored classification refreshes on edits and preserves year-suffix canonical groups');
  const cacheIntegrity=query(replay, `BEGIN;
    INSERT INTO public.games(slug,title,description,updated_at) VALUES('cache-integrity','Synthetic Cache Integrity','nsfw','2001-01-01');
    UPDATE public.games SET explore_primary_safe=true,explore_title_key='forged' WHERE slug='cache-integrity';
    SELECT NOT explore_primary_safe AND explore_title_key='syntheticcacheintegrity' AND updated_at='2001-01-01'::timestamptz
      FROM public.games WHERE slug='cache-integrity';
    UPDATE public.games SET description='Safe primary-game metadata.' WHERE slug='cache-integrity';
    SELECT explore_primary_safe AND updated_at>'2001-01-01'::timestamptz FROM public.games WHERE slug='cache-integrity';
    ROLLBACK;`).split('\n').filter(line=>line==='t'||line==='f');
  assert.deepEqual(cacheIntegrity,['t','t'],'Derived values resist spoofing; maintenance preserves freshness and metadata edits advance it');
  query(replay, "CREATE TABLE public.recovery_fixture(id int primary key,payload text); INSERT INTO public.recovery_fixture VALUES(1,'synthetic restore verification');");
  const dump = spawnSync('docker', ['exec', container, 'pg_dump', '-U', 'postgres', '-d', replay, '--format=custom', '--no-owner'], { maxBuffer: 20 * 1024 * 1024 });
  assert.equal(dump.status, 0, 'Synthetic backup export must succeed');
  createDatabase(restored);
  const restore = spawnSync('docker', ['exec', '-i', container, 'pg_restore', '-U', 'postgres', '-d', restored, '--no-owner', '--exit-on-error'], { input: dump.stdout, maxBuffer: 20 * 1024 * 1024 });
  if (restore.status !== 0) throw new Error(`Local restore failed: ${restore.stderr.toString().slice(-2500)}`);
  assert.equal(query(restored, 'SELECT payload FROM public.recovery_fixture WHERE id=1;').trim(), 'synthetic restore verification');
  assert.equal(query(restored, "SELECT has_column_privilege('anon','public.profiles','role','SELECT'),has_table_privilege('anon','public.user_games','SELECT');").trim(), permissions);
  assert.equal(query(restored,"SET ROLE anon; SELECT public.explore_source_unrestricted(); SELECT public.explore_catalogue_page('all-time',0,'','','default',1,40,'2026-11-16')->>'count'; RESET ROLE;").split('\n').filter(line=>line==='t'||line==='0').join('|'),'t|0','Restored live-input functions and access policies work');
  query(restored,readFileSync('output/targeted-release/proposals/rollback_live_explore_inputs.sql','utf8'));
  assert.equal(query(restored,"SELECT to_regclass('public.explore_inputs') IS NULL AND to_regclass('public.explore_input_state') IS NULL;").trim(),'t');
  assert.equal(query(restored,"SET ROLE anon; SELECT public.explore_catalogue_page('all-time',0,'','','default',1,40,'2026-11-16')->>'count'; RESET ROLE;").split('\n').filter(line=>line==='0').join(''),'0','Rollback retains the compatible original invoker function');
  assert.equal(query(restored, "SELECT has_column_privilege('anon','public.profiles','role','SELECT'),has_table_privilege('anon','public.user_games','SELECT');").trim(), permissions,'Performance rollback must not restore insecure private grants');
  writeFileSync(path.join(output, 'migration-replay.json'), JSON.stringify({ migrations, restore: 'passed', privatePrivileges: 'passed', liveInputsRestore: 'passed', liveInputsRollback: 'passed', backupBytes: dump.stdout.length }, null, 2));
  console.log(`PASS ${files.length} migrations replayed; synthetic backup restored with data and private privileges intact`);
} finally {
  for (const name of created.reverse()) {
    // Names come exclusively from the validated generated list above.
    query('postgres', `DROP DATABASE "${name}" WITH (FORCE);`);
  }
}
