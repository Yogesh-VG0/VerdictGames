// Explicitly approved first publication only. This never runs game ingestion,
// the scheduler job, Auth updates, migrations or an upcoming-snapshot replay.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import postgres from 'postgres';
import {refreshCommunitySnapshots} from './lib/discovery-snapshot.mjs';
import {isUpcomingSnapshot} from '../src/lib/external/rawg-snapshot.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const expected=process.argv.find(value=>value.startsWith('--approved-worker-sha256='))?.split('=')[1];
const workerSha256=hash(readFileSync(new URL('./lib/discovery-snapshot.mjs',import.meta.url)));
const year=new Date().getUTCFullYear();
const keys=['discovery:rawg:all-time:0:v1',...Array.from({length:3},(_,index)=>`discovery:rawg:popular-in-year:${year-index}:v1`)];
if(!process.argv.includes('--publish-approved')) {
 console.log(JSON.stringify({dryRun:true,project:'vjzsvnaswronkctazarn',keys,workerSha256,hostedWrites:0}));
} else {
 assert.notEqual(process.env.VERDICT_LOCAL_VERIFY,'1','Local verification cannot publish hosted snapshots');
 assert.equal(expected,workerSha256,'Exact approved worker checksum required');
 let address;try{address=new URL(process.env.SUPABASE_DB_URL || '');}catch{throw new Error('Invalid approved database configuration');}
 assert.ok(address.hostname==='db.vjzsvnaswronkctazarn.supabase.co' || address.hostname.endsWith('.pooler.supabase.com') && address.username==='postgres.vjzsvnaswronkctazarn');
 assert.equal(address.pathname,'/postgres');assert.ok(process.env.RAWG_API_KEY,'Existing RAWG credential required');
 const sql=postgres(address.href,{max:1,prepare:false,ssl:'require',connect_timeout:5});
 const evidence={project:'vjzsvnaswronkctazarn',keys,workerSha256,completed:false};
 try {
  await sql`SET statement_timeout='3s'`;await sql`SET lock_timeout='500ms'`;
  evidence.before=await sql.begin(async tx=>{await tx`SET TRANSACTION READ ONLY`;await tx`SET LOCAL statement_timeout='3s'`;
   return tx`SELECT feed_key,md5(payload::text) payload_md5,fetched_at FROM public.gx_cache WHERE feed_key IN ${tx(keys)}`;});
  evidence.results=await refreshCommunitySnapshots(sql);assert.ok(evidence.results.every(row=>row.ok),'Incomplete publication; preserve successful keys and investigate');
  const rows=await sql.begin(async tx=>{await tx`SET TRANSACTION READ ONLY`;await tx`SET LOCAL statement_timeout='3s'`;
   return tx`SELECT feed_key,payload,fetched_at FROM public.gx_cache WHERE feed_key IN ${tx(keys)}`;});
  assert.equal(rows.length,4);
  evidence.readback=rows.map(row=>{assert.ok(isUpcomingSnapshot(row.payload));assert.equal(row.payload.complete,true);
   assert.equal(row.payload.count,row.payload.results.length);assert.ok(row.payload.results.length<=250);
   return {key:row.feed_key,count:row.payload.results.length,bytes:Buffer.byteLength(JSON.stringify(row.payload)),sha256:hash(JSON.stringify(row.payload)),fetchedAt:row.fetched_at};});
  evidence.completed=true;
 } finally {await sql.end({timeout:1});writeFileSync('output/targeted-release/hosted-community-rankings.json',JSON.stringify(evidence,null,2));}
 console.log(JSON.stringify(evidence));
}
