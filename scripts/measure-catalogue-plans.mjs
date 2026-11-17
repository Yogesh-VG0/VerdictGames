// Actual historical public catalogue, isolated local database. No hosted writes.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import postgres from 'postgres';
const status = JSON.parse(execFileSync(process.platform==='win32'?'supabase.exe':'supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const address = new URL(status.DB_URL); assert.equal(address.hostname,'127.0.0.1'); address.pathname='/verdict_perf_20261115';
const sql = postgres(address.href,{max:2,prepare:false});
const columns='id,rawg_id,slug,title,release_date,release_status,cover_image,header_image,steam_app_id,score,verdict_score,confidence,review_count,current_players,platforms,genres,tags,description,franchise,developer,publisher,created_at';
const result={measuredAt:new Date().toISOString(),source:'local historical R3 public games only; same table definition and 31 indexes; not hosted execution plans',database:'verdict_perf_20261115',plans:{},samples:{}};
try {
  await sql.begin(async tx=>{
    await tx.unsafe('SET TRANSACTION READ ONLY'); await tx.unsafe('SET LOCAL statement_timeout=5000');
    result.size=(await tx.unsafe("SELECT count(*)::int AS games, sum(pg_column_size(g))::bigint AS row_bytes, sum(octet_length(coalesce(description,'')))::bigint AS description_bytes FROM games g"))[0];
    result.indexes=await tx.unsafe("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='games'");
    for(const [name,where] of [['all-time',"release_date<='2026-11-15' AND review_count>=100"],['year',"release_date BETWEEN '2025-01-01' AND '2025-12-31' AND review_count>=100"],['recent',"release_date BETWEEN '2026-10-16' AND '2026-11-15'"],['genre',"release_date<='2026-11-15' AND genres @> ARRAY['Action']::text[]"]]) {
      const first=`SELECT ${columns} FROM games WHERE ${where} ORDER BY id LIMIT 250`;
      result.plans[name]=(await tx.unsafe(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${first}`))[0]['QUERY PLAN'];
      const start=performance.now(); const rows=await tx.unsafe(`SELECT ${columns} FROM games WHERE ${where} ORDER BY id`);
      result.samples[name]={rows:rows.length,fullProjectionBytes:Buffer.byteLength(JSON.stringify(rows)),queryAndTransferMs:Math.round((performance.now()-start)*100)/100,oldChunkReads:Math.ceil(rows.length/250)+(rows.length%250===0?1:0)};
    }
    const rows=await tx.unsafe(`SELECT ${columns} FROM games ORDER BY id`);
    mkdirSync('.verification',{recursive:true});writeFileSync('.verification/perf-public-catalogue.json',JSON.stringify(rows));
    result.fullProjectionBytes=Buffer.byteLength(JSON.stringify(rows));
  });
  mkdirSync('output/targeted-release',{recursive:true});writeFileSync('output/targeted-release/local-query-plans.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({source:result.source,size:result.size,fullProjectionBytes:result.fullProjectionBytes,samples:result.samples,plans:Object.fromEntries(Object.entries(result.plans).map(([k,v])=>[k,{executionMs:v[0]['Execution Time'],planningMs:v[0]['Planning Time'],node:v[0].Plan['Node Type']}]))},null,2));
} finally {await sql.end({timeout:1});}
