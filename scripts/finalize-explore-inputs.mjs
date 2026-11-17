// Default: verify only. Publication requires an explicit separate approval flag.
// Every value comparison has <=100 source/input rows; source writes between
// snapshots keep their projection atomic through the reviewed AFTER trigger.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {config} from 'dotenv';
import postgres from 'postgres';
import path from 'node:path';
import {exploreInputFields as fields} from './lib/explore-input-fields.mjs';

const argument=name=>process.argv.find(value=>value.startsWith(name+'='))?.slice(name.length+1);
const publish=process.argv.includes('--publish-approved');
const hostedReadOnly=process.argv.includes('--hosted-readonly');
const hostedApproved=process.argv.includes('--hosted-approved');
assert.ok(!(hostedReadOnly&&hostedApproved),'Hosted modes are mutually exclusive');
assert.ok(!(hostedReadOnly&&publish),'Read-only mode cannot publish');
const hosted=hostedApproved||hostedReadOnly;
const dockerLocal=process.argv.includes('--local-docker');
assert.ok(!(hosted&&dockerLocal));
if(hosted&&publish)assert.ok(process.argv.includes('--hosted-approved'),'Read-only mode cannot publish');
const files=readdirSync('supabase/migrations').filter(name=>name.endsWith('_maintain_live_explore_inputs.sql'));assert.equal(files.length,1);
const source=readFileSync('supabase/migrations/'+files[0],'utf8');
const sha=createHash('sha256').update(source).digest('hex');
const triggerBody=source.match(/AS \$maintain\$([\s\S]*?)\$maintain\$/)?.[1];assert.ok(triggerBody);
const expectedTriggerMd5=createHash('md5').update(triggerBody).digest('hex');
let address;
function parseAddress(value){try{return new URL(value);}catch{throw new Error('Invalid database connection configuration');}}
if(hosted){
 assert.equal(argument('--sql-sha'),sha,'Exact reviewed SQL required');config({quiet:true});
 address=parseAddress(process.env.DATABASE_URL||process.env.SUPABASE_DB_URL);
 assert.equal(address.hostname,'db.vjzsvnaswronkctazarn.supabase.co');assert.equal(address.pathname,'/postgres');
}else{
 const state=JSON.parse(execFileSync(process.platform==='win32'?'supabase.exe':'supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 address=parseAddress(state.DB_URL);assert.equal(address.hostname,'127.0.0.1');
 const database=argument('--database');if(database){assert.match(database,/^(verdict_perf_[0-9]{8}|verdict_replay_[a-f0-9]{12})$/);address.pathname='/'+database;}
 if(publish)assert.ok(database,'Local publication requires an isolated verification database');
}
if(dockerLocal){assert.ok(/^(npipe:|unix:)/.test(execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim()));assert.match(address.pathname,/^\/verdict_(perf_[0-9]{8}|replay_[a-f0-9]{12})$/);}
const sql=dockerLocal?null:postgres(address.href,{max:1,prepare:false,connect_timeout:5,ssl:hosted?'require':false});
async function transaction(statement,write=false){
 if(dockerLocal){const run=spawnSync('docker',['exec','-i','supabase_db_Verdict_Games','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',address.pathname.slice(1)],{input:`BEGIN ${write?'':'READ ONLY'}; SET LOCAL lock_timeout='500ms'; SET LOCAL statement_timeout='3s'; ${statement}; COMMIT;`,encoding:'utf8',maxBuffer:2*1024*1024,timeout:15000});
  if(run.status!==0){const error=new Error('Local validation stopped');error.code='LOCAL_SQL';throw error;}const rows=run.stdout.split('\n').filter(x=>x.startsWith('{'));assert.equal(rows.length,1);return JSON.parse(rows[0]);}
 return sql.begin(async tx=>{if(!write)await tx`SET TRANSACTION READ ONLY`;await tx`SET LOCAL lock_timeout='500ms'`;await tx`SET LOCAL statement_timeout='3s'`;const [row]=await tx.unsafe(statement);return row.result;});
}
const uuid=id=>{assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);return "'"+id+"'::uuid";};
const projected=prefix=>'ROW('+fields.map(x=>prefix+'.'+x).join(',')+')';
async function ids(table){
 assert.ok(['games','explore_inputs'].includes(table));const found=[];let cursor;
 for(;;){const batch=await transaction(`SELECT jsonb_build_object('ids',coalesce(jsonb_agg(id ORDER BY id),'[]')) result FROM(SELECT id FROM public.${table} ${cursor?'WHERE id>'+uuid(cursor):''} ORDER BY id LIMIT 1000) batch`);
  found.push(...batch.ids);assert.ok(found.length<=20000,'Finite catalogue budget exceeded');if(batch.ids.length<1000)break;cursor=batch.ids.at(-1);}
 return found;
}
async function preflight(){
 const data=await transaction(`SELECT jsonb_build_object('ready',(SELECT ready FROM public.explore_input_state WHERE singleton),
  'columns',(SELECT jsonb_agg(attname ORDER BY attnum) FROM pg_attribute WHERE attrelid='public.explore_inputs'::regclass AND attnum>0 AND NOT attisdropped),
  'typesMatch',NOT EXISTS(SELECT 1 FROM pg_attribute i LEFT JOIN pg_attribute g ON g.attrelid='public.games'::regclass AND g.attname=i.attname AND g.attnum>0 AND NOT g.attisdropped WHERE i.attrelid='public.explore_inputs'::regclass AND i.attnum>0 AND NOT i.attisdropped AND(g.attname IS NULL OR i.atttypid<>g.atttypid OR i.atttypmod<>g.atttypmod OR i.attcollation<>g.attcollation)),
  'triggerMd5',(SELECT md5(p.prosrc) FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid='public.games'::regclass AND t.tgname='refresh_explore_inputs' AND t.tgfoid='public.refresh_explore_inputs()'::regprocedure AND t.tgenabled IN('O','A') AND t.tgtype=21 AND t.tgattr::text='' AND t.tgqual IS NULL AND p.prosecdef AND p.proconfig @> ARRAY['search_path=""'] AND p.proowner=(SELECT relowner FROM pg_class WHERE oid='public.explore_inputs'::regclass)),
  'primaryKeyValid',EXISTS(SELECT 1 FROM pg_constraint c JOIN pg_index x ON x.indexrelid=c.conindid WHERE c.conrelid='public.explore_inputs'::regclass AND c.contype='p' AND c.convalidated AND NOT c.condeferrable AND x.indisvalid AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='id')]::smallint[]),
  'foreignKeyValid',EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.explore_inputs'::regclass AND c.confrelid='public.games'::regclass AND c.conname='explore_inputs_game_fk' AND c.contype='f' AND c.convalidated AND NOT c.condeferrable AND c.confupdtype='c' AND c.confdeltype='c' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='id')]::smallint[] AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid AND attname='id')]::smallint[]),
  'publicWrite',has_table_privilege('anon','public.explore_inputs','INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated','public.explore_inputs','INSERT,UPDATE,DELETE') OR has_table_privilege('service_role','public.explore_inputs','INSERT,UPDATE,DELETE'),
  'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.explore_inputs'::regclass)) result`);
 assert.deepEqual(data.columns,fields);assert.equal(data.typesMatch,true);assert.equal(data.triggerMd5,expectedTriggerMd5);assert.equal(data.primaryKeyValid,true);assert.equal(data.foreignKeyValid,true);assert.equal(data.publicWrite,false);assert.equal(data.rls,true);return data;
}
const evidence={startedAt:new Date().toISOString(),hosted,publishRequested:publish,sqlSha256:sha,fieldCount:fields.length,sourceWrites:0,projectionWrites:0,batches:[],verifiedRows:0};
const started=performance.now();
try{
 evidence.readyBefore=(await preflight()).ready;if(publish)assert.equal(evidence.readyBefore,false,'Already-ready state is not republished');
 const initial=await ids('games');evidence.sourceRows=initial.length;
 for(let offset=0;offset<initial.length;offset+=100){
  const batch=initial.slice(offset,offset+100),list=batch.map(uuid).join(','),t=performance.now();
  const result=await transaction(`WITH started AS MATERIALIZED(SELECT clock_timestamp() t),
   source AS MATERIALIZED(SELECT ${fields.join(',')} FROM public.games CROSS JOIN started WHERE id IN(${list})),
   inputs AS MATERIALIZED(SELECT ${fields.join(',')} FROM public.explore_inputs WHERE id IN(${list})),
   differences AS(SELECT count(*) n FROM source g FULL JOIN inputs i USING(id) WHERE g.id IS NULL OR i.id IS NULL OR ${projected('g')} IS DISTINCT FROM ${projected('i')})
   SELECT jsonb_build_object('differences',(SELECT n FROM differences),'serverMs',1000*extract(epoch FROM clock_timestamp()-(SELECT t FROM started))) result`);
  assert.equal(Number(result.differences),0,'Input values differ; readiness remains unchanged');evidence.verifiedRows+=batch.length;evidence.batches.push({rows:batch.length,serverMs:result.serverMs,clientMs:Math.round(performance.now()-t)});
 }
 const finalSource=await ids('games'),finalInputs=await ids('explore_inputs');
 assert.deepEqual(finalSource,initial,'Catalogue IDs changed; repeat read-only validation');assert.deepEqual(finalInputs,finalSource,'Missing or orphan projection IDs; do not publish');
 await preflight();evidence.exactCoverage=true;
 if(publish){const result=await transaction("WITH published AS(UPDATE public.explore_input_state SET ready=true WHERE singleton AND NOT ready RETURNING ready) SELECT jsonb_build_object('updated',count(*),'ready',coalesce(bool_and(ready),false)) result FROM published",true);assert.equal(Number(result.updated),1);assert.equal(result.ready,true);evidence.published=true;}
 else evidence.published=false;
 evidence.completedAt=new Date().toISOString();evidence.totalMs=Math.round(performance.now()-started);
}catch(error){evidence.failed=true;evidence.code=/^[A-Z0-9_]{1,30}$/.test(error.code||'')?error.code:'VALIDATION_FAILED';process.exitCode=1;}
finally{if(sql)await sql.end({timeout:1});const output=path.resolve(argument('--evidence-path')||'output/targeted-release/'+(hosted?'hosted':'local')+'-explore-input-finalization.json');assert.ok([path.resolve('.verification')+path.sep,path.resolve('output/targeted-release')+path.sep].some(root=>output.startsWith(root)));writeFileSync(output,JSON.stringify(evidence,null,2));}
console.log(JSON.stringify({hosted,verifiedRows:evidence.verifiedRows,exactCoverage:evidence.exactCoverage,published:evidence.published,sourceWrites:0,projectionWrites:0,totalMs:evidence.totalMs,failed:evidence.failed,code:evidence.code}));
