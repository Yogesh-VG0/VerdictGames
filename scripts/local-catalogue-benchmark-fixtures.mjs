// Reversible PUBLIC catalogue fixture only; hard-loopback guarded. Never loads
// production credentials or user/profile/Auth data, and never resets a database.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import postgres from 'postgres';
const path='.verification/catalogue-benchmark-fixtures.json';
const status=JSON.parse(execFileSync(process.platform==='win32'?'supabase.exe':'supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const address=new URL(status.DB_URL);assert.equal(address.hostname,'127.0.0.1');
const target=postgres(address.href,{max:1,prepare:false});
const sourceAddress=new URL(address);sourceAddress.pathname='/verdict_perf_20261115';
const source=postgres(sourceAddress.href,{max:1,prepare:false});
try {
  if(process.argv[2]==='cleanup') {
    assert.ok(existsSync(path),'Only clean up IDs recorded by this fixture helper');
    const manifest=JSON.parse(readFileSync(path,'utf8'));
    await target.begin(async sql=>{
      if(manifest.listIds.length) await sql`DELETE FROM public.lists WHERE id IN ${sql(manifest.listIds)}`;
      if(manifest.gameIds.length) await sql`DELETE FROM public.games WHERE id IN ${sql(manifest.gameIds)}`;
      await sql`DELETE FROM public.gx_cache WHERE feed_key='discovery:rawg:upcoming:v1'`;
      if(manifest.snapshot) await sql`INSERT INTO public.gx_cache ${sql(manifest.snapshot)}`;
    });
    unlinkSync(path);console.log('Removed only recorded public catalogue fixtures and restored the original local discovery snapshot.');
  } else {
    assert.ok(!existsSync(path),'An earlier fixture manifest exists; finish its cleanup first');
    const manifest={gameIds:[],listIds:[],snapshot:null,source:'historical public R3 catalogue only'};
    await target.begin(async sql=>{
      const existing=await sql`SELECT * FROM public.gx_cache WHERE feed_key='discovery:rawg:upcoming:v1'`;manifest.snapshot=existing[0]||null;
      await sql`DELETE FROM public.gx_cache WHERE feed_key='discovery:rawg:upcoming:v1'`;
      for(const table of ['games','lists','list_items']) {
        const columns=(await sql`SELECT attname FROM pg_attribute WHERE attrelid=${'public.'+table}::regclass AND attnum>0 AND NOT attisdropped`).map(row=>row.attname);
        const original=await source.unsafe('SELECT * FROM public.'+table+(table==='lists'?' WHERE is_public=true':''));
        let rows=original.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>columns.includes(key))));
        if(table==='lists') rows=rows.filter(row=>row.owner_id===null);
        if(table==='list_items') rows=rows.filter(row=>manifest.listIds.includes(row.list_id));
        const keys=rows.length?Object.keys(rows[0]):[];
        for(let index=0;index<rows.length;index+=200) {
          const inserted=await sql`INSERT INTO public.${sql(table)} ${sql(rows.slice(index,index+200),keys)} ON CONFLICT DO NOTHING RETURNING id`;
          if(table==='games') manifest.gameIds.push(...inserted.map(row=>row.id));
          if(table==='lists') manifest.listIds.push(...inserted.map(row=>row.id));
        }
      }
      // Written before commit so interrupted/failed runs still have an exact
      // allowlist for cleanup; a rolled-back insert leaves nothing to delete.
      writeFileSync(path,JSON.stringify(manifest));
    });
    const [counts]=await target`SELECT (SELECT count(*) FROM public.games)::int AS games,(SELECT count(*) FROM public.lists WHERE is_public)::int AS public_lists`;
    console.log(JSON.stringify({source:manifest.source,insertedGames:manifest.gameIds.length,insertedLists:manifest.listIds.length,...counts,rawgSnapshotPresent:false}));
  }
} finally {await Promise.all([source.end({timeout:1}),target.end({timeout:1})]);}
