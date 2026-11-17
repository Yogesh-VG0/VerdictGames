// Default is strictly loopback. Hosted execution requires an explicit flag,
// fixed project target and the reviewed migration checksum supplied by owner.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {config} from 'dotenv';
import postgres from 'postgres';
import path from 'node:path';
const hosted=process.argv.includes('--hosted-approved');
const argument=name=>process.argv.find(value=>value.startsWith(name+'='))?.slice(name.length+1);
const file=readdirSync('supabase/migrations').filter(name=>name.endsWith('_cache_explore_classification.sql'));
assert.equal(file.length,1,'Exactly one reviewed classification migration required');
const sha=createHash('sha256').update(readFileSync('supabase/migrations/'+file[0])).digest('hex');
let address;
if(hosted){
 assert.equal(argument('--sql-sha'),sha,'Hosted execution requires the exact reviewed SQL checksum');
 config({quiet:true});address=new URL(process.env.DATABASE_URL||process.env.SUPABASE_DB_URL);
 assert.equal(address.hostname,'db.vjzsvnaswronkctazarn.supabase.co','Hosted execution is restricted to the approved project');
 assert.equal(address.pathname,'/postgres');
}else{
 const state=JSON.parse(execFileSync(process.platform==='win32'?'supabase.exe':'supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 address=new URL(state.DB_URL);assert.equal(address.hostname,'127.0.0.1');
 const database=argument('--database');
 if(database){assert.match(database,/^(verdict_perf_[0-9]{8}|verdict_replay_[a-f0-9]{12})$/);address.pathname='/'+database;}
}
const sql=postgres(address.href,{max:1,prepare:false,connect_timeout:5,ssl:hosted?'require':false});
const fields=['title_key','year_suffix','franchise_key','developer_key','publisher_key','primary_safe','early_access'].map(s=>'explore_'+s);
const strip='ARRAY['+fields.map(name=>"'"+name+"'").join(',')+']';
const missing=fields.map(name=>'g.'+name+' IS NULL').join(' OR ');
const evidence={startedAt:new Date().toISOString(),hosted,sqlSha256:sha,batchSize:100,batches:[],updated:0,allSourceValuesPreserved:true};
const started=performance.now();
try{
 const attrs=await sql`SELECT attname,attgenerated FROM pg_attribute WHERE attrelid='public.games'::regclass AND attname IN ${sql(fields)} AND NOT attisdropped`;
 assert.equal(attrs.length,7);assert.ok(attrs.every(a=>a.attgenerated===''),'Backfill requires the approved ordinary derived columns');
 const triggers=await sql`SELECT tgname,tgenabled FROM pg_trigger WHERE tgrelid='public.games'::regclass AND NOT tgisinternal ORDER BY tgname`;
 assert.deepEqual(triggers.map(t=>t.tgname),['set_games_updated_at','zzz_refresh_explore_classification'],'Review unexpected triggers before source-preserving backfill');
 assert.ok(triggers.every(t=>['O','A'].includes(t.tgenabled)));
 evidence.before=(await sql`SELECT pg_table_size('public.games') heap,pg_indexes_size('public.games') indexes`)[0];
 // Snapshot only unfinished public-game IDs once. Repeated ordered scans of
 // the already completed prefix exceeded the hosted statement budget. Keep
 // IDs in memory only; recheck eligibility under row locks in every batch.
 const pending=await sql.begin(async tx=>{
  await tx`SET TRANSACTION READ ONLY`;await tx`SET LOCAL statement_timeout='3s'`;
  return tx.unsafe('SELECT g.id FROM public.games g WHERE '+missing+' LIMIT 20001');
 });
 assert.ok(pending.length<=20000,'Finite 20,000-row budget exceeded');
 pending.sort((a,b)=>a.id.localeCompare(b.id));
 evidence.pendingAtStart=pending.length;
 for(let index=0;index<pending.length;index+=100){
  const ids=pending.slice(index,index+100).map(row=>row.id);
  const t=performance.now();
  const result=await sql.begin(async tx=>{
   await tx`SET LOCAL lock_timeout='500ms'`;await tx`SET LOCAL statement_timeout='3s'`;
   const [result]=await tx.unsafe(`WITH batch AS MATERIALIZED (
    SELECT g.id,md5((to_jsonb(g)-${strip})::text) before_hash FROM public.games g
    WHERE g.id=ANY($1::uuid[]) AND (${missing}) ORDER BY g.id LIMIT 100 FOR UPDATE SKIP LOCKED
   ), changed AS (
    UPDATE public.games g SET explore_primary_safe=NULL FROM batch b WHERE g.id=b.id
    RETURNING g.id,md5((to_jsonb(g)-${strip})::text) after_hash
   ) SELECT count(*)::int updated,coalesce(bool_and(b.before_hash=c.after_hash),true) preserved
     FROM changed c JOIN batch b USING(id)`,[ids]);
   if(!result.preserved)evidence.allSourceValuesPreserved=false;
   assert.equal(result.preserved,true,'Source fields or freshness timestamp changed; batch rolled back');return result;
  });
  evidence.batches.push({rows:result.updated,ms:Math.round(performance.now()-t)});evidence.updated+=result.updated;
 }
 const [remaining]=await sql.unsafe('SELECT count(*)::int missing FROM public.games g WHERE '+missing);
 evidence.remaining=remaining.missing;assert.equal(remaining.missing,0,'Derived fields remain; stop release and resume only after active writers finish');
 evidence.after=(await sql`SELECT pg_table_size('public.games') heap,pg_indexes_size('public.games') indexes`)[0];
 evidence.completedAt=new Date().toISOString();evidence.totalMs=Math.round(performance.now()-started);
}catch(error){evidence.failed=true;evidence.code=error.code;throw error;}
finally{
 await sql.end({timeout:1});
 const output=argument('--evidence-path')||'output/targeted-release/'+(hosted?'hosted':'local')+'-classification-backfill.json';
 const resolved=path.resolve(output);
 assert.ok([path.resolve('.verification')+path.sep,path.resolve('output/targeted-release')+path.sep].some(root=>resolved.startsWith(root)),'Evidence stays within the verification workspace');
 writeFileSync(resolved,JSON.stringify(evidence,null,2));
}
console.log(JSON.stringify({hosted,updated:evidence.updated,remaining:evidence.remaining,allSourceValuesPreserved:true,totalMs:evidence.totalMs,batches:evidence.batches.length}));
