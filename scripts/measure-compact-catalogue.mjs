import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync,writeFileSync } from 'node:fs';
import postgres from 'postgres';
const status=JSON.parse(execFileSync(process.platform==='win32'?'supabase.exe':'supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const address=new URL(status.DB_URL);assert.equal(address.hostname,'127.0.0.1');address.pathname='/verdict_perf_20261115';
const migration=readFileSync('supabase/migrations/20261115140534_optimize_public_explore_queries.sql','utf8');
const body=migration.match(/RETURN \(\n([\s\S]*?)\n  \);/)[1];
const result={measuredAt:new Date().toISOString(),scope:'historical public catalogue in isolated local database; cold framework/connection, not cold storage or hosted latency',cases:[]};
for(const [type,genre] of [['all-time',''],['genre','Action'],['popular-in-year',''],['recent','']]) {
  const sql=postgres(address.href,{max:1,prepare:false});
  try {
    const samples=[];
    for(let index=0;index<3;index++) {
      const start=performance.now();const [row]=await sql.unsafe('SELECT public.explore_catalogue_page($1,2025,$2,\'\',\'default\',1,40,\'2026-11-15\') AS data',[type,genre]);
      samples.push({connectionCold:index===0,ms:Math.round((performance.now()-start)*100)/100,bytes:Buffer.byteLength(JSON.stringify(row.data)),count:row.data.count});
    }
    const literals={p_type:"'"+type+"'",p_year:'2025',p_genre:"'"+genre+"'",p_platform:"''",p_sort:"'default'",p_page:'1',p_page_size:'40',p_day:"'2026-11-15'::date",selected_sort:type==='all-time'||type==='popular-in-year'?"'rating'":type==='recent'?"'newest'":"'popular'"};
    const query=body.replace(/\b(p_type|p_year|p_genre|p_platform|p_sort|p_page_size|p_page|p_day|selected_sort)\b/g,name=>literals[name]);
    const [plan]=await sql.unsafe('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+query);
    result.cases.push({type,genre,samples,plan:plan['QUERY PLAN']});
  } finally {await sql.end({timeout:1});}
}
writeFileSync('output/targeted-release/compact-query-plans.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result.cases.map(item=>({type:item.type,genre:item.genre,samples:item.samples,executionMs:item.plan[0]['Execution Time'],tempReadBlocks:item.plan[0].Plan['Temp Read Blocks'],tempWrittenBlocks:item.plan[0].Plan['Temp Written Blocks']})),null,2));
