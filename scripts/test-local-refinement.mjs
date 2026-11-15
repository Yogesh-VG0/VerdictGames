// Disposable loopback-only signup, Mailpit, username and private-list checks.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(url).hostname, '127.0.0.1');
assert.equal(new URL(process.env.SUPABASE_DB_URL).hostname, '127.0.0.1');
const base = 'http://127.0.0.1:3100';
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession:false, autoRefreshToken:false } });
const sql = postgres(process.env.SUPABASE_DB_URL, { max:2 });
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const output = 'output/playwright/refinement-auth'; mkdirSync(output, { recursive:true });
const run = randomUUID().replaceAll('-','').slice(0,10);
const username = `refine_${run}`;
const email = `refine-${run}@example.test`;
const password = `silver otters ${run} visit the moon`;
const userIds = [], listIds = [], profileIds = [];
const evidence = { checks: [], latencyMs: {}, mail: {} };
function check(value, label) { assert.ok(value, label); evidence.checks.push(label); console.log(`PASS ${label}`); }
async function messageFor(subject, recipient = email) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const inbox = await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json();
    const message = inbox.messages?.find(item => item.Subject === subject && item.To?.some(to => to.Address === recipient));
    if (message) return (await (await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`)).json()).HTML;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Expected local Mailpit message was not delivered');
}
function verificationLink(html) {
  const link = html.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/i)?.[1]?.replaceAll('&amp;','&');
  assert.ok(link, 'Email contains a secure verification link');
  assert.equal(new URL(link).hostname, '127.0.0.1');
  return link;
}
let browser;
try {
  const [trigger] = await sql`select exists(select 1 from pg_trigger where tgname='validate_profile_username') as present`;
  if (!trigger.present) {
    const connection = await sql.reserve();
    try { await connection.unsafe(readFileSync('supabase/migrations/20261115094938_enforce_username_integrity.sql','utf8')); }
    finally { connection.release(); }
  }
  const collisionIds = [randomUUID(),randomUUID()]; profileIds.push(...collisionIds);
  const name = `race_${run}`;
  const concurrent = await Promise.allSettled(collisionIds.map((id,index) => sql`insert into public.profiles(id,username) values(${id},${index ? name.toUpperCase() : name})`));
  check(concurrent.filter(result => result.status === 'fulfilled').length === 1, 'database permits only one concurrent case-insensitive username');
  await assert.rejects(() => sql`insert into public.profiles(id,username) values(${randomUUID()},'ADMIN')`, /Invalid or reserved/);
  check(true, 'database rejects reserved usernames directly');
  const policyClient = createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const weak = await policyClient.auth.signUp({email:`weak-${run}@example.test`,password:'shortpass'});
  check(Boolean(weak.error) && !weak.data.user, 'local Auth rejects short passwords through the direct API');
  browser = await chromium.launch({ headless:true, channel:'chrome' });
  const context = await browser.newContext({ viewport:{ width:390,height:844 }, extraHTTPHeaders:{ 'x-forwarded-for':`127.9.${parseInt(run.slice(0,2),16)}.1` } });
  const page = await context.newPage();
  const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.name));
  await page.goto(`${base}/library`);
  await page.getByRole('button',{ name:'Sign In to Get Started' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button',{ name:'Sign Up',exact:true }).click();
  let checks = 0;
  await page.route('**/api/auth/check-username?*', async route => {
    checks++;
    const name = new URL(route.request().url()).searchParams.get('username');
    await new Promise(resolve => setTimeout(resolve, name === 'older_name' ? 700 : 75));
    await route.fulfill({ json:{ success:true,data:{ available: name !== 'newer_name', reason: name === 'newer_name' ? 'Username is already taken' : null } } });
  });
  let started = performance.now();
  await dialog.getByLabel('Username',{exact:true}).fill('normal_name');
  await dialog.getByText('Username is available',{exact:true}).waitFor();
  evidence.latencyMs.normal = Math.round(performance.now()-started);
  await dialog.getByLabel('Username',{exact:true}).fill('older_name');
  await page.waitForTimeout(300);
  started = performance.now();
  await dialog.getByLabel('Username',{exact:true}).fill('newer_name');
  await dialog.getByText('Username is already taken',{exact:true}).waitFor();
  evidence.latencyMs.slowObsolete = Math.round(performance.now()-started);
  await page.waitForTimeout(800);
  check(await dialog.getByText('Username is already taken',{exact:true}).isVisible(), 'obsolete username responses cannot replace the current result');
  await page.unroute('**/api/auth/check-username?*');
  await page.route('**/api/auth/check-username?*', route => route.fulfill({ status:503,json:{ success:false,error:'Simulated unavailable' } }));
  await dialog.getByLabel('Username',{exact:true}).fill('failed_name');
  await dialog.getByText('Temporarily unable to verify. You can retry when submitting.',{exact:true}).waitFor();
  check(await dialog.getByText('Username is available',{exact:true}).count() === 0, 'failed username checks show an unavailable state');
  await page.unroute('**/api/auth/check-username?*');
  await dialog.getByLabel('Username',{exact:true}).fill(username);
  await dialog.getByText('Username is available',{exact:true}).waitFor();
  await dialog.getByLabel('Email',{exact:true}).fill(email);
  await dialog.getByLabel('Password',{exact:true}).fill(password);
  await dialog.getByLabel('Confirm password',{exact:true}).fill(password);
  await page.screenshot({path:`${output}/signup-390.png`});
  await dialog.getByRole('button',{name:'Create Account',exact:true}).click();
  await dialog.getByText('Account created! Check your email to verify your account before signing in.',{exact:true}).waitFor();
  check(await dialog.getByRole('button',{name:/Resend in/}).isDisabled(), 'confirmation resend has an accessible cooldown');
  const confirmation = await messageFor('Confirm your VerdictGames account');
  check(confirmation.includes('Welcome to VerdictGames') && !confirmation.includes('<img'), 'local signup sends the branded tracking-free confirmation template');
  evidence.mail.confirmation = 'received in local Mailpit';
  const identity = await admin.from('profiles').select('auth_id,id').eq('username',username).single(); assert.ifError(identity.error);
  userIds.push(identity.data.auth_id);
  await page.goto(verificationLink(confirmation));
  await page.waitForURL(`${base}/library`);
  await page.waitForFunction(async () => (await fetch('/api/auth/me')).status === 200);
  check(true, 'signup verification establishes a session and preserves the library destination');
  // Create one private disposable list; public reads and the other identity must not see it.
  const fixture = await admin.from('lists').insert({ slug:`private-refinement-${run}`,title:'Private local refinement list',owner_id:identity.data.id,is_public:false }).select('id').single(); assert.ifError(fixture.error); listIds.push(fixture.data.id);
  const own = await page.evaluate(async () => { const r=await fetch('/api/lists?scope=mine&view=summary'); return { status:r.status, cache:r.headers.get('cache-control'), body:await r.json() }; });
  check(own.status === 200 && own.cache.includes('no-store') && own.body.data.items.some(item=>item.id===fixture.data.id), 'owner private-list summaries are uncached and visible only to the owner');
  const publicLists = await (await fetch(`${base}/api/lists?view=summary`)).json();
  check(!publicLists.data.items.some(item=>item.id===fixture.data.id), 'private collection is absent from the public summary');
  const other = await admin.auth.admin.createUser({email:`other-${run}@example.test`,password,email_confirm:true,user_metadata:{preferred_username:`other_${run}`}}); assert.ifError(other.error); userIds.push(other.data.user.id);
  const otherClient = createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  assert.ifError((await otherClient.auth.signInWithPassword({email:other.data.user.email,password})).error);
  const denied = await otherClient.from('lists').select('id').eq('id',fixture.data.id);
  check(!denied.error && denied.data.length===0,'second identity cannot directly read the private collection');
  const expiredRecipient=other.data.user.email;
  const expiredRequest=await otherClient.auth.resetPasswordForEmail(expiredRecipient,{redirectTo:base+'/api/auth/callback?flow=recovery'});
  assert.ifError(expiredRequest.error);
  const limited=await otherClient.auth.resetPasswordForEmail(expiredRecipient,{redirectTo:base+'/api/auth/callback?flow=recovery'});
  check(Boolean(limited.error)&&limited.error.status===429,'direct recovery resend respects the local provider rate limit');
  const expiredMessage=await messageFor('Reset your VerdictGames password',expiredRecipient);
  await sql`UPDATE auth.users SET recovery_sent_at=now()-interval '2 hours' WHERE id=${other.data.user.id}`;
  const expiredContext=await browser.newContext();
  const expiredPage=await expiredContext.newPage();
  await expiredPage.goto(verificationLink(expiredMessage));
  await expiredPage.waitForURL(/reset-password/);
  await expiredPage.getByRole('heading',{name:'Your link may have expired',exact:true}).waitFor({state:'visible',timeout:10000});
  check(await expiredPage.getByRole('heading',{name:'Your link may have expired',exact:true}).isVisible()
    && await expiredPage.getByRole('button',{name:'Send New Reset Link',exact:true}).isVisible(),'actually expired recovery link renders a recoverable request-new-link state');
  await expiredContext.close();
  await page.goto(`${base}/reset-password`);
  // Request recovery through the UI in the same PKCE browser context.
  await page.locator('#desktop-profile-button').count();
  const recoveryClient = createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  // Actual UI sign out clears its session; then use the public recovery form.
  await context.clearCookies();
  await page.goto(`${base}/reset-password`);
  await page.getByPlaceholder('Email',{exact:true}).fill(email);
  await page.getByRole('button',{name:'Send New Reset Link',exact:true}).click();
  const recovery = await messageFor('Reset your VerdictGames password');
  check(recovery.includes('Choose a new password'), 'password recovery sends the branded template');
  evidence.mail.recovery = 'received in local Mailpit';
  await page.goto(verificationLink(recovery));
  await page.waitForURL(/\/reset-password/);
  await page.getByLabel('New password',{exact:true}).fill(`copper foxes ${run} watch the stars`);
  await page.getByLabel('Confirm new password',{exact:true}).fill(`copper foxes ${run} watch the stars`);
  await page.getByRole('button',{name:'Update Password',exact:true}).click();
  await page.getByText("Password updated. You're signed in and ready to continue.",{exact:true}).waitFor();
  check(true, 'recovery link verifies and a long passphrase updates successfully');
  assert.ifError((await recoveryClient.auth.signInWithPassword({email,password:`copper foxes ${run} watch the stars`})).error);
  check(true, 'updated password signs in through Supabase Auth');
  check(pageErrors.length===0,'authentication browser flow has no JavaScript errors');
  evidence.usernameRequestsDuringSimulations=checks;
} finally {
  if (browser) await browser.close();
  if (!userIds.length) { const lookup=await admin.from('profiles').select('auth_id').eq('username',username).maybeSingle(); if(lookup.data?.auth_id) userIds.push(lookup.data.auth_id); }
  for (const id of listIds) await admin.from('lists').delete().eq('id',id);
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
  if(profileIds.length) await sql`delete from public.profiles where id in ${sql(profileIds)}`;
  await sql.end();
  writeFileSync(`${output}/results.json`,JSON.stringify(evidence,null,2));
}
