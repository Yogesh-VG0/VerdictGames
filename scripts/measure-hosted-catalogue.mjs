// Read-only hosted diagnostics. No row contents, credentials or private queries.
import {config} from 'dotenv';
import postgres from 'postgres';
import {readFileSync,writeFileSync} from 'node:fs';
config({quiet:true});
const target=process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if(!target) throw new Error('Existing database configuration required');
const sql=postgres(target,{max:1,prepare:false,connect_timeout:5});
const migrationPath=process.argv[2]||'supabase/migrations/20261115191625_optimize_public_explore_queries.sql';
const evidencePath=process.argv[3]||'output/targeted-release/hosted-query-plans.json';
const evidence={measuredAt:new Date().toISOString(),scope:'Hosted read-only database diagnostics; no schema or data changes',host:new URL(target).hostname};
try {
 const start=performance.now();
 await sql.begin(async tx=>{
  await tx`SET TRANSACTION READ ONLY`;
  await tx`SET LOCAL statement_timeout=5000`;
  await tx`SELECT 1`;
  evidence.connectionAndProbeMs=Math.round(performance.now()-start);
  evidence.version=await tx`SELECT current_setting('server_version') version, EXISTS(SELECT 1 FROM pg_collation WHERE collname='en-US-x-icu') english_collation`;
  evidence.connections=await tx`SELECT usename,backend_type,state,wait_event_type,wait_event,count(*)::int connections,
   max(extract(epoch FROM now()-query_start))::int oldest_query_seconds FROM pg_stat_activity
   GROUP BY usename,backend_type,state,wait_event_type,wait_event ORDER BY connections DESC`;
  evidence.tables=await tx`SELECT relname,n_live_tup,n_dead_tup,last_analyze,last_autoanalyze,seq_scan,idx_scan
   FROM pg_stat_user_tables WHERE schemaname='public' AND relname IN ('games','lists','list_items','gx_cache')`;
  evidence.indexes=await tx`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('games','lists','list_items')`;
  evidence.exploreFunction=await tx`SELECT to_regprocedure('public.explore_catalogue_page(text,integer,text,text,text,integer,integer,date)')::text function`;
  evidence.counts=await tx`SELECT count(*)::int games,coalesce(sum(octet_length(coalesce(description,''))),0)::bigint description_bytes FROM public.games`;
  await tx`SET LOCAL ROLE anon`;
  evidence.firstChunkPlan=await tx`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id,title,release_date,score,review_count FROM public.games
   WHERE review_count>=100 AND release_date<=CURRENT_DATE ORDER BY id LIMIT 250`;
  const migration=readFileSync(migrationPath,'utf8');
  const body=migration.match(/RETURN \(\r?\n([\s\S]*?)\r?\n  \);/)[1];
  const literals={p_type:"'all-time'",p_year:'0',p_genre:"''",p_platform:"''",p_sort:"'default'",p_page:'1',p_page_size:'40',p_day:'CURRENT_DATE',selected_sort:"'rating'"};
  const query=body.replace(/\b(p_type|p_year|p_genre|p_platform|p_sort|p_page_size|p_page|p_day|selected_sort)\b/g,name=>literals[name]);
  evidence.compactPlan=await tx.unsafe('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+query);
  const readStart=performance.now();
  const [page]=await tx.unsafe(query);
  const value=Object.values(page)[0];
  evidence.compactRead={ms:Math.round((performance.now()-readStart)*100)/100,rows:value.rows.length,count:value.count,bytes:Buffer.byteLength(JSON.stringify(value))};
 });
} catch(error){evidence.error={name:error.name,code:error.code,message:error.code==='57014'?'Statement timeout':undefined};}
finally{await sql.end({timeout:1});}
writeFileSync(evidencePath,JSON.stringify({...evidence,migrationPath},null,2));
console.log(JSON.stringify({measuredAt:evidence.measuredAt,connectionAndProbeMs:evidence.connectionAndProbeMs,version:evidence.version,
 connections:evidence.connections,tables:evidence.tables,exploreFunction:evidence.exploreFunction,counts:evidence.counts,
 firstChunkExecutionMs:evidence.firstChunkPlan?.[0]?.['QUERY PLAN']?.[0]?.['Execution Time'],
 compactExecutionMs:evidence.compactPlan?.[0]?.['QUERY PLAN']?.[0]?.['Execution Time'],compactRead:evidence.compactRead,error:evidence.error},null,2));
