import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import postgres from 'postgres';
import {writeFileSync,mkdirSync} from 'node:fs';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;assert.equal(new URL(url).hostname,'127.0.0.1');
assert.equal(new URL(process.env.SUPABASE_DB_URL).hostname,'127.0.0.1');
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const sql=postgres(process.env.SUPABASE_DB_URL,{max:1});
const users=[],run=randomUUID().slice(0,8),evidence={checks:[],providerObservations:[]};
const check=(value,message)=>{assert.ok(value,message);evidence.checks.push(message);console.log('PASS '+message);};
try {
  for(const [label,password] of [['long-ascii',('silver otters visit the moon '+run+' ').repeat(3).slice(0,72)],['unicode','明亮星光照耀寂静山谷中的清澈河流']]) {
    const email='policy-'+label+'-'+run+'@example.test';
    const response=await client.auth.signUp({email,password,options:{data:{preferred_username:'policy_'+label.replace('-','')+'_'+run}}});
    if(response.data.user) users.push(response.data.user.id);
    check(!response.error&&response.data.user,label+' passphrase accepted through direct local Auth API');
    assert.ifError((await admin.auth.admin.updateUserById(response.data.user.id,{email_confirm:true})).error);
    check(!(await client.auth.signInWithPassword({email,password})).error,label+' passphrase signs in without truncation or normalization');
    await client.auth.signOut();
  }
  const long=await client.auth.signUp({email:'policy-too-long-'+run+'@example.test',password:'violet lanterns '.repeat(6)});
  if(long.data.user) users.push(long.data.user.id);
  evidence.providerObservations.push({case:'over-72-bytes',accepted:!long.error,code:long.error?.code});
  check(Boolean(long.error),'direct local Auth rejects oversized bcrypt input');
  const shortUnicode=await client.auth.signUp({email:'policy-short-unicode-'+run+'@example.test',password:'明亮星光照耀寂静山谷中的河流'});
  if(shortUnicode.data.user) users.push(shortUnicode.data.user.id);
  evidence.providerObservations.push({case:'unicode-minimum',codePoints:[...'明亮星光照耀寂静山谷中的河流'].length,bytes:Buffer.byteLength('明亮星光照耀寂静山谷中的河流'),accepted:!shortUnicode.error,code:shortUnicode.error?.code});
} finally {
  for(const id of users) await admin.auth.admin.deleteUser(id);
  await sql.end({timeout:1});mkdirSync('output/targeted-release',{recursive:true});
  writeFileSync('output/targeted-release/auth-policy.json',JSON.stringify(evidence,null,2));
}
