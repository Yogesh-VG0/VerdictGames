// Changed-row-only policy refresh. Defaults to local CLI configuration and
// refuses hosted targets unless the exact reviewed migration hash is supplied.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import postgres from 'postgres';
const arg=name=>process.argv.find(value=>value.startsWith(name+'='))?.slice(name.length+1);
const hosted=process.argv.includes('--hosted');
const migration='supabase/migrations/20261118140247_distinguish_mature_from_adult_only.sql';
const hash=createHash('sha256').update(readFileSync(migration)).digest('hex');
let address;
if(hosted) {
  assert.equal(arg('--approved-sql-sha256'),hash,'Exact migration checksum approval required');
  try { address=new URL(process.env.SUPABASE_DB_URL || ''); }
  catch { throw new Error('Invalid approved database connection configuration'); }
  assert.ok(address.hostname==='db.vjzsvnaswronkctazarn.supabase.co' || address.hostname.endsWith('.pooler.supabase.com') && address.username==='postgres.vjzsvnaswronkctazarn');
  assert.equal(address.pathname,'/postgres');
} else {
  const status=JSON.parse(execFileSync(process.platform==='win32'?'supabase.exe':'supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
  address=new URL(status.DB_URL);assert.equal(address.hostname,'127.0.0.1');
  if(arg('--database')) {assert.match(arg('--database'),/^verdict_(perf_\d{8}|replay_[a-f0-9]{12})$/);address.pathname='/'+arg('--database');}
}
const sql=postgres(address.href,{max:1,prepare:false,ssl:hosted?'require':false});
const evidence={hosted,migrationSha256:hash,updated:0,batches:[],sourceValuesPreserved:true};
const changed=`g.explore_primary_safe IS DISTINCT FROM public.explore_primary_safe(g.tags,g.genres,g.description,g.title)`;
try {
  const triggers=await sql`SELECT tgname,tgenabled FROM pg_trigger WHERE tgrelid='public.games'::regclass AND NOT tgisinternal ORDER BY tgname`;
  assert.deepEqual(triggers.map(row=>row.tgname),['refresh_explore_inputs','set_games_updated_at','zzz_refresh_explore_classification']);
  assert.ok(triggers.every(row=>['O','A'].includes(row.tgenabled)));
  // Exactly one bounded comparison; batches subsequently address known IDs.
  const pending=await sql.begin(async tx=>{await tx`SET TRANSACTION READ ONLY`;await tx`SET LOCAL statement_timeout='3s'`;return tx.unsafe(`SELECT g.id FROM public.games g WHERE ${changed} LIMIT 20001`);});
  assert.ok(pending.length<=20000,'Finite policy-refresh budget exceeded');
  evidence.pending=pending.length;
  for(let index=0;index<pending.length;index+=100) {
    const ids=pending.slice(index,index+100).map(row=>row.id);const started=performance.now();
    const result=await sql.begin(async tx=>{
      await tx`SET LOCAL lock_timeout='500ms'`;await tx`SET LOCAL statement_timeout='3s'`;
      const rows=await tx`SELECT id,to_jsonb(g)-'explore_primary_safe' before FROM public.games g WHERE id IN ${tx(ids)} ORDER BY id FOR UPDATE`;
      await tx`UPDATE public.games SET explore_primary_safe=NULL WHERE id IN ${tx(ids)}`;
      const after=await tx`SELECT id,to_jsonb(g)-'explore_primary_safe' after FROM public.games g WHERE id IN ${tx(ids)}`;
      for(const row of rows) assert.deepEqual(after.find(value=>value.id===row.id)?.after,row.before,'Source or timestamp changed; transaction rolled back');
      const [check]=await tx.unsafe(`SELECT count(*)::int bad FROM public.games g JOIN public.explore_inputs i USING(id)
        WHERE g.id=ANY($1::uuid[]) AND ((${changed}) OR i.explore_primary_safe IS DISTINCT FROM g.explore_primary_safe)`,[ids]);
      assert.equal(check.bad,0,'Projection maintenance failed; transaction rolled back');
      return rows.length;
    });
    evidence.updated+=result;evidence.batches.push({rows:result,ms:Math.round(performance.now()-started)});
  }
  const [last]=await sql.begin(async tx=>{await tx`SET TRANSACTION READ ONLY`;await tx`SET LOCAL statement_timeout='3s'`;return tx.unsafe(`SELECT count(*)::int remaining FROM public.games g WHERE ${changed}`);});
  evidence.remaining=last.remaining;assert.equal(last.remaining,0);
} finally {
  await sql.end({timeout:1});
  const output=arg('--evidence-path') || 'output/targeted-release/'+(hosted?'hosted':'local')+'-safety-policy-refresh.json';
  assert.match(output,/^(?:\.verification|output\/targeted-release)\/[a-zA-Z0-9._/-]+\.json$/);
  assert.ok(!output.includes('..'));writeFileSync(output,JSON.stringify(evidence,null,2));
}
console.log(JSON.stringify(evidence));
