import assert from 'node:assert/strict';
import { randomInt,randomUUID } from 'node:crypto';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import postgres from 'postgres';
import { refreshIgdbCatalogue,upsertIgdbEssential } from './lib/igdb-fallback.mjs';
const address=new URL(process.env.SUPABASE_DB_URL);assert.equal(address.hostname,'127.0.0.1');
const sql=postgres(address.href,{max:1});const id=randomInt(1000000000,1900000000);
const slug='local-igdb-fallback-'+id;
const run='local-igdb-worker-'+randomUUID();
const workerId=id+1,workerSlug=slug+'-worker';
const directory=mkdtempSync(path.join(tmpdir(),'verdict-igdb-worker-'));
const nextYear=new Date();nextYear.setUTCFullYear(nextYear.getUTCFullYear()+1);
const game={id,slug,name:'Local Independent Provider Fixture',game_type:0,
  summary:'A synthetic future game used only to verify independent provider metadata.',
  first_release_date:Math.floor(nextYear.getTime()/1000),cover:{image_id:'co123'},
  platforms:[{name:'PC (Microsoft Windows)'}],genres:[{name:'Role-playing (RPG)'}],themes:[]};
const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('No external provider calls allowed in this local test');};
try {
  const query=async(endpoint,body)=>body.includes('where id =')?[]:[game];
  const first=await refreshIgdbCatalogue(sql,query);
  assert.equal(first.created,1);
  let [stored]=await sql`SELECT * FROM public.games WHERE igdb_id=${id}`;
  assert.equal(stored.rawg_id,null);assert.equal(stored.review_count,0);assert.equal(stored.verdict_score,0);
  assert.deepEqual(stored.platforms,['PC']);assert.deepEqual(stored.genres,['RPG']);
  assert.match(stored.cover_image,/images\.igdb\.com/);
  const canonical=stored.slug;
  await sql`UPDATE public.games SET review_count=1234,verdict_score=87,confidence=0.9,rawg_id=${id},
    description='Preserve this manually edited description.',cover_image='https://images.igdb.com/igdb/image/upload/t_cover_big/coOLD.jpg',
    media_source='igdb',release_status='early_access' WHERE id=${stored.id}`;
  await upsertIgdbEssential(sql,{...game,slug:slug+'-renamed',summary:'Fresh independent metadata without replacing the editorial description.'},{allowCreate:true});
  [stored]=await sql`SELECT * FROM public.games WHERE igdb_id=${id}`;
  assert.equal(stored.slug,canonical);assert.equal(stored.rawg_id,id);assert.equal(stored.review_count,1234);
  assert.equal(stored.verdict_score,87);assert.equal(stored.description,'Preserve this manually edited description.');
  assert.equal(stored.release_status,'early_access');assert.ok(stored.cover_image.includes('coOLD'));
  const early=Date.parse('2024-05-06')/1000,full=Date.parse('2025-09-25')/1000;
  await upsertIgdbEssential(sql,{...game,slug:slug+'--provider',first_release_date:early,game_status:null,release_dates:[
    {date:early,date_format:{format:'YYYYMMDD'},status:{name:'Early Access'}},
    {date:full,date_format:{format:'YYYYMMDD'},status:{name:'Full Release'}}]});
  [stored]=await sql`SELECT * FROM public.games WHERE igdb_id=${id}`;
  assert.equal(stored.slug,canonical);assert.equal(stored.release_status,'released');
  assert.equal(stored.release_date.toISOString().slice(0,10),'2025-09-25');
  await upsertIgdbEssential(sql,{...game,first_release_date:early,game_status:null,release_dates:[
    {date:early,date_format:{format:'YYYYMMDD'},status:{name:'Early Access'}}]});
  [stored]=await sql`SELECT * FROM public.games WHERE igdb_id=${id}`;
  assert.equal(stored.release_status,'released');assert.equal(stored.release_date.toISOString().slice(0,10),'2025-09-25');
  assert.equal(stored.verdict_score,87);assert.equal(stored.review_count,1234);assert.equal(stored.rawg_id,id);
  console.log('PASS verified full-release progress, disambiguated provider slug, original public identity and no regression from historical release dates');
  const [mapping]=await sql`SELECT * FROM public.game_sources WHERE source_name='igdb' AND source_game_id=${String(id)}`;
  assert.equal(mapping.game_id,stored.id);
  const [collision]=await sql`INSERT INTO public.games(slug,title,igdb_id) VALUES(${slug+'-collision'},'Local conflicting provider fixture',${id}) RETURNING id`;
  try {await assert.rejects(()=>upsertIgdbEssential(sql,game,{allowCreate:true}),/Ambiguous/);}
  finally {await sql`DELETE FROM public.games WHERE id=${collision.id}`;}
  await assert.rejects(()=>refreshIgdbCatalogue(sql,async()=>null),/unavailable/);
  console.log('PASS permanent RAWG outage: new IGDB upcoming record, source identity, normalized metadata, preserved scores/editorials/artwork, ambiguity rejection and provider failure visibility');
  // Exercise the actual health-gate -> CLI worker boundary, with every fetch
  // intercepted before the process can contact a provider.
  const preload=path.join(directory,'providers.mjs'),output=path.join(directory,'outputs.txt');
  writeFileSync(preload,`globalThis.fetch=async input=>{
    const url=new URL(String(input));
    if(url.origin==='https://id.twitch.tv') return Response.json({access_token:'local-only',expires_in:3600});
    if(url.origin==='https://api.igdb.com') return Response.json([JSON.parse(process.env.LOCAL_IGDB_FIXTURE)]);
    if(url.origin==='https://api.rawg.io') return new Response('Provider permanently unavailable',{status:401});
    throw new Error('External network blocked in local worker test');
  };`);
  writeFileSync(output,'');
  const env={...process.env,DATABASE_URL:address.href,SUPABASE_DB_URL:address.href,VERDICT_LOCAL_VERIFY:'1',
    RAWG_API_KEY:'local-unavailable',TWITCH_CLIENT_ID:'local-only',TWITCH_CLIENT_SECRET:'local-only',
    GITHUB_RUN_ID:run,GITHUB_OUTPUT:output,DISCOVER_INTERVAL_HOURS:'0',SCHEDULER_DB_MAX_CONNECTIONS:'2',
    LOCAL_IGDB_FIXTURE:JSON.stringify({...game,id:workerId,slug:workerSlug})};
  const execute=(file,extra=[],overrides={})=>spawnSync(process.execPath,['--import',pathToFileURL(preload).href,file,...extra],
    {env:{...env,...overrides},encoding:'utf8',timeout:30000});
  const rejected=execute('scripts/heroku-discover-games.mjs',[],{DATABASE_URL:'postgres://invalid.invalid/verification'});
  assert.equal(rejected.status,1);
  assert.match(rejected.stderr,/Local verification refuses a non-loopback database/);
  const gate=execute('scripts/check-rawg-availability.mjs',['discover-standard']);
  assert.equal(gate.status,0,gate.stderr);
  assert.match(readFileSync(output,'utf8'),/discovery_provider=igdb/);
  const firstWorker=execute('scripts/heroku-discover-games.mjs',[],{DISCOVERY_PROVIDER:'igdb'});
  assert.ok([0,1].includes(firstWorker.status),firstWorker.stderr);
  assert.match(firstWorker.stdout,/independent IGDB essential-metadata progress/,firstWorker.stderr);
  const [inserted]=await sql`SELECT rawg_id,review_count FROM public.games WHERE igdb_id=${workerId}`;
  assert.ok(inserted,firstWorker.stdout+'\n'+firstWorker.stderr);
  assert.equal(inserted.rawg_id,null);assert.equal(inserted.review_count,0);
  // Own disposable ledger entries make the third-deferred alert deterministic.
  for(let index=0;index<2;index++) await sql`INSERT INTO scheduler_runs(job_name,status,finished_at,metadata)
    VALUES('discover-games','deferred',now(),${sql.json({github_run_id:run})})`;
  const repeated=execute('scripts/heroku-discover-games.mjs',[],{DISCOVERY_PROVIDER:'igdb'});
  assert.equal(repeated.status,1,repeated.stderr);
  assert.match(repeated.stderr,/Three consecutive attempts/);
  const [progress]=await sql`SELECT count(*)::int n FROM scheduler_runs WHERE metadata->>'github_run_id'=${run}
    AND metadata->>'provider'='igdb' AND status='deferred' AND rows_created+rows_updated>0`;
  assert.equal(progress.n,2,'Both CLI runs record real progress while retaining RAWG outage status');
  console.log('PASS actual RAWG health gate selects IGDB, CLI worker adds a new game and repeated outages alert after recording progress');
} finally {
  globalThis.fetch=originalFetch;
  await sql`DELETE FROM public.game_sources WHERE source_name='igdb' AND source_game_id=${String(id)}`;
  await sql`DELETE FROM public.games WHERE slug=${slug} OR slug=${slug+'-collision'}`;
  await sql`DELETE FROM public.game_sources WHERE source_name='igdb' AND source_game_id=${String(workerId)}`;
  await sql`DELETE FROM public.games WHERE slug=${workerSlug} AND igdb_id=${workerId}`;
  await sql`DELETE FROM scheduler_runs WHERE metadata->>'github_run_id'=${run}`;
  await sql.end({timeout:1});
  assert.equal(path.dirname(path.resolve(directory)),path.resolve(tmpdir()));
  assert.ok(path.basename(directory).startsWith('verdict-igdb-worker-'));
  rmSync(directory,{recursive:true,force:true});
}
