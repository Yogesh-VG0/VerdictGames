// Runs only against the newly created migration-replay database. No hosted
// connection, credentials, fixture or production permission changes.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {exploreInputFields as fields} from './lib/explore-input-fields.mjs';
assert.ok(/^(npipe:|unix:)/.test(execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim()));
const db=process.argv.find(x=>x.startsWith('--database='))?.slice('--database='.length);assert.match(db||'',/^verdict_replay_[a-f0-9]{12}$/);
const container='supabase_db_Verdict_Games';
function query(database,input){const run=spawnSync('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',database],{input,encoding:'utf8',maxBuffer:5*1024*1024,timeout:30000});if(run.status!==0)throw new Error(run.stderr.slice(0,1000));return run.stdout;}
const checks=[];
 const fallback=JSON.parse(query(db,"SET ROLE anon; SELECT public.explore_catalogue_page('all-time',0,'','','default',1,40,'2026-11-16');"));assert.equal(fallback.count,2);checks.push('ready=false preserves original source results');
 execFileSync(process.execPath,['scripts/backfill-explore-inputs.mjs',...(process.platform==='win32'?['--local-docker']:[]),'--database='+db,'--evidence-path=.verification/prototype-exact-input-backfill.json'],{stdio:['ignore','pipe','pipe'],timeout:60000});
 const helper=JSON.parse(readFileSync('.verification/prototype-exact-input-backfill.json','utf8'));assert.equal(helper.copied,2);assert.equal(helper.validation.ready,true);checks.push('exact helper locks/copies two rows, validates all inputs and publishes readiness');
 execFileSync(process.execPath,['scripts/backfill-explore-inputs.mjs',...(process.platform==='win32'?['--local-docker']:[]),'--database='+db,'--evidence-path=.verification/input-backfill-repeat.json'],{stdio:['ignore','pipe','pipe'],timeout:60000});
 const repeated=JSON.parse(readFileSync('.verification/input-backfill-repeat.json','utf8'));assert.equal(repeated.copied,0);assert.equal(repeated.visited,2);assert.equal(repeated.validation.ready,true);checks.push('backfill resumption avoids identical-row writes');
 const lost=JSON.parse(query(db,"BEGIN; DELETE FROM public.explore_inputs; UPDATE public.explore_input_state SET ready=false; SET LOCAL ROLE anon; SELECT public.explore_catalogue_page('all-time',0,'','','default',1,40,'2026-11-16'); ROLLBACK;"));
 assert.deepEqual({count:lost.count,rows:lost.rows},{count:fallback.count,rows:fallback.rows});checks.push('unready/lost projection uses original accurate source query');
 const partial=JSON.parse(query(db,"BEGIN; ALTER TABLE public.games DISABLE TRIGGER zzz_refresh_explore_classification; UPDATE public.games SET explore_title_key=NULL WHERE slug='preclass-a'; ALTER TABLE public.games ENABLE TRIGGER zzz_refresh_explore_classification; SET LOCAL ROLE anon; SELECT public.explore_catalogue_page('all-time',0,'','','default',1,40,'2026-11-16'); ROLLBACK;"));
 assert.deepEqual({count:partial.count,rows:partial.rows},{count:fallback.count,rows:fallback.rows});checks.push('unclassified source rows union before ranking without loss or duplication');
 const test=`BEGIN;
 INSERT INTO public.games(slug,title,release_date,review_count,verdict_score,confidence,genres,platforms,developer) VALUES
 ('live-wide',repeat('遊戲',600),'2020-01-01',5000,95,1,ARRAY['Action'],ARRAY['PC'],repeat('Studio',500)),
 ('live-fast','Synthetic Shared (2020)','2020-01-01',5000,92,1,ARRAY['Action'],ARRAY['PC'],'Studio'),
 ('live-wide-sibling','Synthetic Shared (2021)','2021-01-01',5000,96,1,ARRAY['Action'],ARRAY['PlayStation 5'],repeat('Studio',500)),
 ('live-low','Low Evidence','2020-01-01',1,100,1,ARRAY['Action'],ARRAY['PC'],'Studio'),
 ('live-hidden','Hidden','2020-01-01',5000,100,1,ARRAY['Action'],ARRAY['PC'],'Studio');
 SELECT json_build_object('kind','inputs','equal',NOT EXISTS(SELECT 1 FROM public.games g FULL JOIN public.explore_inputs i USING(id) WHERE g.id IS NULL OR i.id IS NULL OR ROW(${fields.map(x=>'g.'+x).join(',')}) IS DISTINCT FROM ROW(${fields.map(x=>'i.'+x).join(',')})));
 UPDATE public.games SET description='nsfw' WHERE slug='live-wide';
 SELECT json_build_object('kind','description','safe',(SELECT explore_primary_safe FROM public.explore_inputs WHERE slug='live-wide'));
 UPDATE public.games SET description='',tags=ARRAY['Early Access'] WHERE slug='live-wide';
 SELECT json_build_object('kind','tags','early',(SELECT explore_early_access FROM public.explore_inputs WHERE slug='live-wide'));
 INSERT INTO public.games(slug,title) VALUES('live-conflict','Conflict') ON CONFLICT(slug) DO NOTHING;
 INSERT INTO public.games(slug,title) VALUES('live-conflict','Conflict') ON CONFLICT(slug) DO NOTHING;
 SELECT json_build_object('kind','conflict','count',(SELECT count(*) FROM public.explore_inputs WHERE slug='live-conflict'));
 GRANT INSERT,UPDATE ON public.games TO authenticated;
 CREATE POLICY prototype_writer ON public.games FOR ALL TO authenticated USING(true) WITH CHECK(true);
 SET LOCAL ROLE authenticated;
 UPDATE public.games SET current_players=12345 WHERE slug='live-fast';
 RESET ROLE;
 SELECT json_build_object('kind','writer','players',(SELECT current_players FROM public.explore_inputs WHERE slug='live-fast'));
 CREATE POLICY prototype_private ON public.games AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(slug <> 'live-hidden');
 SET LOCAL ROLE anon;
 SELECT json_build_object('kind','restricted','guard',public.explore_source_unrestricted(),'projectionRows',(SELECT count(*) FROM public.explore_inputs),'sourceRows',(SELECT count(*) FROM public.games),'rpcCount',(public.explore_catalogue_page('genre',0,'Action','','popular',1,40,'2026-11-16')->>'count')::int);
 RESET ROLE;
 DELETE FROM public.games WHERE slug='live-fast';
 SELECT json_build_object('kind','delete','remaining',(SELECT count(*) FROM public.explore_inputs WHERE slug='live-fast'));
 ROLLBACK;`;
 const rows=query(db,test).trim().split('\n').filter(x=>x.startsWith('{')).map(x=>JSON.parse(x));
 assert.equal(rows.find(x=>x.kind==='inputs').equal,true);assert.equal(rows.find(x=>x.kind==='description').safe,false);assert.equal(rows.find(x=>x.kind==='tags').early,true);assert.equal(rows.find(x=>x.kind==='conflict').count,1);assert.equal(rows.find(x=>x.kind==='writer').players,12345);assert.equal(rows.find(x=>x.kind==='delete').remaining,0);
 const restricted=rows.find(x=>x.kind==='restricted');assert.equal(restricted.guard,false);assert.equal(restricted.projectionRows,0);assert.equal(restricted.rpcCount,3);checks.push('wide Unicode metadata, implicit classifiers, accepted/conflicting inserts, authenticated writer and cascade delete');checks.push('restrictive source policy disables all projection access and retains original filtered ranking');
 for(const role of ['anon','authenticated','service_role']){
  assert.throws(()=>query(db,`BEGIN; SET LOCAL ROLE ${role}; UPDATE public.explore_inputs SET current_players=9; COMMIT;`),/permission denied/);
 }checks.push('anon/authenticated/service_role cannot write projection directly');
 assert.throws(()=>query(db,"BEGIN; CREATE TEMP TABLE bogus(LIKE public.games INCLUDING DEFAULTS); CREATE TRIGGER bogus AFTER INSERT ON bogus FOR EACH ROW EXECUTE FUNCTION public.refresh_explore_inputs(); INSERT INTO bogus(slug,title) VALUES('bogus','Bogus'); ROLLBACK;"),/Invalid Explore input maintenance trigger context/);checks.push('definer trigger rejects attachment to another relation');
 // Two actual sessions: keep a repeatable-read catalogue snapshot open while
 // another session commits a policy tightening. The guard must not use stale
 // pg_policy rows to select the projection.
 const session=spawn('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',db],{stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='';session.stdout.on('data',d=>stdout+=d);session.stderr.on('data',d=>stderr+=d);
 async function until(marker){const start=Date.now();while(!stdout.includes(marker)){if(Date.now()-start>10000)throw new Error('Local race synchronization timed out');await new Promise(r=>setTimeout(r,25));}}
 session.stdin.write("BEGIN ISOLATION LEVEL REPEATABLE READ; SET ROLE anon; SELECT 'READY:'||public.explore_source_unrestricted();\n");await until('READY:');assert.ok(stdout.includes('READY:false'));
 query(db,"CREATE POLICY prototype_tightened ON public.games AS RESTRICTIVE FOR SELECT TO anon USING(slug <> 'preclass-a');");
 session.stdin.end("SELECT json_build_object('guard',public.explore_source_unrestricted(),'sourceCount',(SELECT count(*) FROM public.games),'rpcCount',(public.explore_catalogue_page('all-time',0,'','','default',1,40,'2026-11-16')->>'count')::int); ROLLBACK;\n");
 const exit=await new Promise(resolve=>session.on('close',resolve));assert.equal(exit,0,stderr.slice(0,500));
 const race=JSON.parse(stdout.split('\n').find(x=>x.startsWith('{')));assert.equal(race.guard,false);assert.equal(race.sourceCount,1);assert.equal(race.rpcCount,1);checks.push('two-session repeatable-read policy tightening uses original source visibility');
 query(db,'DROP POLICY prototype_tightened ON public.games;');
 assert.equal(query(db,'SET ROLE anon; SELECT public.explore_source_unrestricted();').trim(),'t');
writeFileSync('.verification/explore-input-checks.json',JSON.stringify({measuredAt:new Date().toISOString(),scope:'Exact SQL/helper in disposable local migration-replay database; two actual sessions, no hosted changes',checks,rows,race,helper,repeated},null,2));console.log('PASS '+checks.join('; '));
