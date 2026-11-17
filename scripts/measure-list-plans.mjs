// Only public historical lists and their memberships enter the disposable DB.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import postgres from 'postgres';
const data=readFileSync('.private-backups/production-2026-11-15/data.sql','utf8');
const schema=readFileSync('.private-backups/production-2026-11-15/schema.sql','utf8');
let statements='BEGIN;\n';let publicIds;
for(const table of ['lists','list_items']) {
  const header=data.match(new RegExp('^COPY "public"\\."'+table+'" \\([^\\n]+ FROM stdin;\\r?$','m'));assert.ok(header);
  const start=header.index+header[0].length,tail=data.indexOf('\n\\.',start);assert.ok(tail>start);
  let rows=data.slice(start,tail).replace(/^\r?\n/,'').replace(/\r\n/g,'').split('\n');
  const cols=[...header[0].slice(header[0].indexOf('(')).matchAll(/"([^"]+)"/g)].map(value=>value[1]);
  if(table==='lists') {rows=rows.filter(row=>row.split('\t')[cols.indexOf('is_public')]==='t');publicIds=new Set(rows.map(row=>row.split('\t')[cols.indexOf('id')]));}
  else rows=rows.filter(row=>publicIds.has(row.split('\t')[cols.indexOf('list_id')]));
  const definition=schema.match(new RegExp('CREATE TABLE(?: IF NOT EXISTS)? "public"\\."'+table+'" \\([\\s\\S]*?\\n\\);'))[0];
  const indexes=[...schema.matchAll(new RegExp('^CREATE (?:UNIQUE )?INDEX [^\\n]+ ON "public"\\."'+table+'"[^\\n]+;\\r?$','gm'))].map(value=>value[0]);
  const constraints=[...schema.matchAll(new RegExp('^ALTER TABLE ONLY "public"\\."'+table+'"\\r?\\n\\s+ADD CONSTRAINT[^;]+;\\r?$','gm'))].map(value=>value[0]).filter(value=>!/FOREIGN KEY/i.test(value));
  statements+=[definition,header[0],rows.join('\n'),'\\.'].join('\n')+'\n'+constraints.concat(indexes).join('\n')+'\nANALYZE public.'+table+';\n';
}
statements+='COMMIT;';
const setup=spawnSync('docker',['exec','-i','supabase_db_Verdict_Games','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','verdict_perf_20261115','-q'],{input:statements,encoding:'utf8'});
assert.equal(setup.status,0,setup.stderr);
const status=JSON.parse(execFileSync(process.platform==='win32'?'supabase.exe':'supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const address=new URL(status.DB_URL);assert.equal(address.hostname,'127.0.0.1');address.pathname='/verdict_perf_20261115';
const sql=postgres(address.href,{max:2,prepare:false});
const result={source:'historical public lists in isolated local database; not hosted timings'};
try {
  const start=performance.now();
  const lists=await sql`SELECT id FROM lists WHERE is_public=true ORDER BY is_system_managed DESC,created_at DESC,id LIMIT 25`;
  const items=await sql`SELECT list_id,game_id,position FROM list_items WHERE list_id IN ${sql(lists.slice(0,24).map(row=>row.id))} ORDER BY position,id`;
  const ids=[...new Set(items.map(row=>row.game_id))];
  const columns='id,slug,title,cover_image,header_image,description,genres,tags,platforms,score,verdict_score,review_count,confidence,steam_total_count,critic_source_count,critic_score,community_score,release_date,release_status,is_provisional,verdict_label,steam_app_id,franchise,developer,publisher';
  const games=await sql.unsafe('SELECT '+columns+' FROM games WHERE id IN ('+ids.map((_,i)=>'$'+(i+1)).join(',')+')',ids);
  Object.assign(result,{lists:lists.length,memberships:items.length,uniqueGames:ids.length,projectedBytes:Buffer.byteLength(JSON.stringify(games)),
    queryAndTransferMs:Math.round((performance.now()-start)*100)/100,
    previousRoundTrips:2+Math.ceil(ids.length/100),parallelGameBatches:Math.ceil(ids.length/200),
    membershipPlan:(await sql`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT list_id,game_id,position FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE is_public=true) ORDER BY position,id`)[0]['QUERY PLAN']});
  writeFileSync('output/targeted-release/list-query-plans.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({...result,membershipPlan:result.membershipPlan[0]['Execution Time']},null,2));
} finally {await sql.end({timeout:1});}
