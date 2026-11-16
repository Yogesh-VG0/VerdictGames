// Copies only public ranking inputs; never updates a source game. Every source
// batch is locked before upsert so an older snapshot cannot overwrite a newer
// trigger result. Until full validation succeeds, RPC uses its original query.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {config} from 'dotenv';
import postgres from 'postgres';
import path from 'node:path';
import {exploreInputFields as fields} from './lib/explore-input-fields.mjs';

const argument=name=>process.argv.find(value=>value.startsWith(name+'='))?.slice(name.length+1);
const hosted=process.argv.includes('--hosted-approved');
const dockerLocal=process.argv.includes('--local-docker');
assert.ok(!(hosted&&dockerLocal),'Docker transport is local only');
const files=readdirSync('supabase/migrations').filter(name=>name.endsWith('_maintain_live_explore_inputs.sql'));
assert.equal(files.length,1);
const sha=createHash('sha256').update(readFileSync('supabase/migrations/'+files[0])).digest('hex');
let address;
if(hosted){
 assert.equal(argument('--sql-sha'),sha,'Exact reviewed SQL checksum required');
 config({quiet:true});address=new URL(process.env.DATABASE_URL||process.env.SUPABASE_DB_URL);
 assert.equal(address.hostname,'db.vjzsvnaswronkctazarn.supabase.co');assert.equal(address.pathname,'/postgres');
}else{
 const state=JSON.parse(execFileSync(process.platform==='win32'?'supabase.exe':'supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 address=new URL(state.DB_URL);assert.equal(address.hostname,'127.0.0.1');
 const database=argument('--database');if(database){assert.match(database,/^(verdict_perf_[0-9]{8}|verdict_replay_[a-f0-9]{12})$/);address.pathname='/'+database;}
}
if(dockerLocal){
 const endpoint=execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim();
 assert.ok(endpoint.startsWith('npipe:')||endpoint.startsWith('unix:'));
 assert.match(address.pathname,/^\/verdict_(perf_[0-9]{8}|replay_[a-f0-9]{12})$/,'Docker transport requires an isolated verification database');
}
const sql=dockerLocal?null:postgres(address.href,{max:1,prepare:false,connect_timeout:5,ssl:hosted?'require':false});
async function transaction(statement,readOnly=false){
 if(dockerLocal){
  const input=`BEGIN ${readOnly?'READ ONLY':''}; SET LOCAL lock_timeout='500ms'; SET LOCAL statement_timeout='3s'; ${statement}; COMMIT;`;
  const run=spawnSync('docker',['exec','-i','supabase_db_Verdict_Games','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',address.pathname.slice(1)],{input,encoding:'utf8',maxBuffer:4*1024*1024,timeout:15000});
  if(run.status!==0){const error=new Error('Local Docker SQL failed');error.code=/ERROR:\s+([^\n]+)/.test(run.stderr)?'LOCAL_SQL':'LOCAL_TRANSPORT';throw error;}
  const rows=run.stdout.split('\n').filter(x=>x.startsWith('{'));assert.equal(rows.length,1);return JSON.parse(rows[0]);
 }
 return sql.begin(async tx=>{
  if(readOnly)await tx`SET TRANSACTION READ ONLY`;
  await tx`SET LOCAL lock_timeout='500ms'`;await tx`SET LOCAL statement_timeout='3s'`;
  const [row]=await tx.unsafe(statement);return row.result;
 });
}
const fieldSql=fields.join(','),projected=prefix=>'ROW('+fields.map(x=>prefix+'.'+x).join(',')+')';
const evidence={startedAt:new Date().toISOString(),hosted,transport:dockerLocal?'local Docker psql':'native postgres',sqlSha256:sha,batchSize:100,batches:[],visited:0,copied:0,sourceWrites:0};
const started=performance.now();
try{
 const preflight=await transaction(`SELECT jsonb_build_object('stateRows',(SELECT count(*) FROM public.explore_input_state),
  'trigger',(SELECT count(*) FROM pg_trigger WHERE tgrelid='public.games'::regclass AND tgname='refresh_explore_inputs' AND tgenabled IN ('O','A')),
  'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.explore_inputs'::regclass),
  'columns',(SELECT jsonb_agg(attname ORDER BY attnum) FROM pg_attribute WHERE attrelid='public.explore_inputs'::regclass AND attnum>0 AND NOT attisdropped),
  'sourceTypesMatch',NOT EXISTS(SELECT 1 FROM pg_attribute i LEFT JOIN pg_attribute g ON g.attrelid='public.games'::regclass AND g.attname=i.attname AND g.attnum>0 AND NOT g.attisdropped
   WHERE i.attrelid='public.explore_inputs'::regclass AND i.attnum>0 AND NOT i.attisdropped
    AND (g.attname IS NULL OR i.atttypid<>g.atttypid OR i.atttypmod<>g.atttypmod OR i.attcollation<>g.attcollation)),
  'publicWrite',has_table_privilege('anon','public.explore_inputs','INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated','public.explore_inputs','INSERT,UPDATE,DELETE'),
  'ids',(SELECT coalesce(jsonb_agg(id ORDER BY id),'[]') FROM(SELECT id FROM public.games LIMIT 20001) ids)) result`,true);
 assert.equal(preflight.stateRows,1);assert.equal(preflight.trigger,1);assert.equal(preflight.rls,true);assert.equal(preflight.publicWrite,false);
 assert.deepEqual(preflight.columns,fields,'Every projection column must be copied and validated');assert.equal(preflight.sourceTypesMatch,true,'Projection types/collations must match original game fields');
 evidence.fieldCount=fields.length;evidence.sourceTypesMatch=true;
 assert.ok(preflight.ids.length<=20000,'Finite catalogue budget exceeded');
 assert.ok(preflight.ids.every(id=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)));
 await transaction("WITH changed AS(UPDATE public.explore_input_state SET ready=false WHERE singleton RETURNING 1) SELECT jsonb_build_object('rows',count(*)) result FROM changed");
 evidence.pendingAtStart=preflight.ids.length;
 for(let offset=0;offset<preflight.ids.length;offset+=100){
  const ids=preflight.ids.slice(offset,offset+100).map(id=>"'"+id+"'::uuid").join(',');
  const t=performance.now();const result=await transaction(`WITH started AS MATERIALIZED(SELECT clock_timestamp() t),
   source AS MATERIALIZED(SELECT ${fieldSql} FROM public.games CROSS JOIN started WHERE id IN (${ids}) ORDER BY id FOR UPDATE OF games),
   copied AS(INSERT INTO public.explore_inputs AS existing(${fieldSql}) SELECT ${fieldSql} FROM source
    ON CONFLICT(id) DO UPDATE SET ${fields.filter(x=>x!=='id').map(x=>x+'=excluded.'+x).join(',')}
    WHERE ${projected('existing')} IS DISTINCT FROM ${projected('excluded')} RETURNING 1)
   SELECT jsonb_build_object('rows',count(*),'serverMs',1000*extract(epoch FROM clock_timestamp()-(SELECT t FROM started))) result FROM copied`);
  evidence.batches.push({...result,clientMs:Math.round(performance.now()-t)});evidence.visited+=Math.min(100,preflight.ids.length-offset);evidence.copied+=result.rows;
 }
 // This single transaction validates both missing/orphan IDs and every input,
 // then publishes readiness. Concurrent source writes maintain their inputs in
 // the same transaction, so they cannot create a post-validation stale window.
 const validation=await transaction(`WITH differences AS MATERIALIZED(SELECT count(*) n FROM public.games g FULL JOIN public.explore_inputs i USING(id)
   WHERE g.id IS NULL OR i.id IS NULL OR ${projected('g')} IS DISTINCT FROM ${projected('i')}),
  published AS(UPDATE public.explore_input_state SET ready=true WHERE singleton AND (SELECT n FROM differences)=0 RETURNING ready)
  SELECT jsonb_build_object('differences',(SELECT n FROM differences),'ready',coalesce((SELECT ready FROM published),false)) result`);
 evidence.validation=validation;assert.equal(validation.differences,0);assert.equal(validation.ready,true);
 evidence.completedAt=new Date().toISOString();evidence.totalMs=Math.round(performance.now()-started);
}catch(error){evidence.failed=true;evidence.code=/^[A-Z0-9_]{1,30}$/.test(error.code||'')?error.code:'UNCLASSIFIED';throw new Error('Explore-input backfill stopped; see sanitized receipt. Readiness is published only after full validation.',{cause:undefined});}
finally{
 if(sql)await sql.end({timeout:1});
 const output=path.resolve(argument('--evidence-path')||'output/targeted-release/'+(hosted?'hosted':'local')+'-explore-input-backfill.json');
 assert.ok([path.resolve('.verification')+path.sep,path.resolve('output/targeted-release')+path.sep].some(root=>output.startsWith(root)));
 writeFileSync(output,JSON.stringify(evidence,null,2));
}
console.log(JSON.stringify({hosted,copied:evidence.copied,batches:evidence.batches.length,sourceWrites:0,ready:evidence.validation.ready,totalMs:evidence.totalMs}));
