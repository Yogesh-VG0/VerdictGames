// Fresh Auth fixtures only. Fail before creating clients unless every service
// is loopback; never load application .env files or accept a hosted target.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
assert.equal(process.env.VERDICT_LOCAL_VERIFY, '1');
const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
for (const address of [api, process.env.SUPABASE_DB_URL]) assert.equal(new URL(address).hostname, '127.0.0.1');
const base = 'http://127.0.0.1:3100';
const mail = 'http://127.0.0.1:54324';
const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1 });
const admin = createClient(api, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const publicClient = () => createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const output = 'output/playwright/email-flows'; mkdirSync(output, { recursive: true });
const run = randomUUID().replaceAll('-', '').slice(0, 9);
const password = `violet otters ${run} visit the moon`;
const replacement = `copper foxes ${run} watch the stars`;
const emails = [], ids = [], contexts = [];
const evidence = { target: 'loopback only', mode: process.env.NODE_ENV, result: 'running', checks: [], screenshots: [], hostedWrites: 0, cleaned: false };
function check(value, label) { assert.ok(value, label); evidence.checks.push(label); console.log('PASS ' + label); }
async function message(subject, recipient) {
  for (let i = 0; i < 40; i++) {
    const inbox = await (await fetch(mail + '/api/v1/messages')).json();
    const entry = inbox.messages?.find(x => x.Subject === subject && x.To?.some(y => y.Address === recipient));
    if (entry) return (await (await fetch(mail + '/api/v1/message/' + entry.ID)).json()).HTML;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('Expected local test email not received');
}
function otp(html) { const value = html.match(/>\s*(\d{6,10})\s*</)?.[1]; assert.ok(value, 'Email includes a numeric OTP'); return value; }
async function legacyConfirmationLink(id) {
  const [row] = await sql`select confirmation_token from auth.users where id=${id}`;
  assert.ok(row.confirmation_token);
  return base + '/auth/confirm#token_hash=' + encodeURIComponent(row.confirmation_token);
}
async function enterConfirmation(page, email, code) {
  await page.getByLabel('Email address', {exact:true}).fill(email);
  await page.getByRole('button', {name:'Enter confirmation code',exact:true}).click();
  await page.getByLabel('Email verification code', {exact:true}).fill(code);
  await page.getByRole('button', {name:'Verify email and sign in',exact:true}).click();
}
let browser;
async function context(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, extraHTTPHeaders: { 'x-forwarded-for': `127.70.${parseInt(run.slice(0,2),16)}.${contexts.length + 1}` }, ...options }); contexts.push(ctx);
  // Browser tests cannot reach providers, analytics or production accidentally.
  await ctx.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    return host === '127.0.0.1' ? route.continue() : route.abort();
  });
  return ctx;
}
async function signup(ctx, label) {
  const email = `${label}-${run}@example.test`; emails.push(email);
  const page = await ctx.newPage(); await page.goto(base + '/library');
  await page.getByRole('button', { name: 'Sign In to Get Started', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Sign Up', exact: true }).click();
  await dialog.getByLabel('Username', { exact: true }).fill(`${label}_${run}`);
  await dialog.getByText('Username is available', { exact: true }).waitFor();
  await dialog.getByLabel('Email', { exact: true }).fill(email);
  await dialog.getByLabel('Password', { exact: true }).fill(password);
  await dialog.getByLabel('Confirm password', { exact: true }).fill(password);
  await dialog.locator('button[type=submit]').click();
  await dialog.getByRole('heading', { name: 'Check your email', exact: true }).waitFor();
  check(!await dialog.locator('#auth-password').count(), 'signup waiting step removes password fields');
  const [row] = await sql`select id from auth.users where email=${email}`; assert.ok(row); ids.push(row.id);
  return { page, dialog, email, id: row.id, html: await message('Confirm your VerdictGames account', email) };
}
async function capture(page, name, width, scheme) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 950 });
  const targetLabel = scheme === 'light' ? 'Switch to light mode' : 'Switch to dark mode';
  const theme = page.getByRole('button', { name: targetLabel, exact: true }).first();
  if (await theme.count()) await theme.click();
  check(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), name + ' fits viewport');
  const file = `${output}/${name}.png`; await page.screenshot({ path: file }); evidence.screenshots.push(file);
}
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL } : {}) });
  const ctx = await context();
  const a = await signup(ctx, 'emaila');
  await capture(a.page, 'signup-code-phone', 390, 'dark');
  await a.page.setViewportSize({width:1440,height:950});
  check(!a.html.includes('token_hash=') && !a.html.includes('/auth/v1/verify'), 'new confirmation email contains only a code and a non-consuming form address');
  check(otp(a.html).length === 6, 'local Auth issues the proposed six-digit confirmation code');
  const link = await legacyConfirmationLink(a.id);
  const confirmation = await ctx.newPage(); await confirmation.goto(base + '/auth/confirm');
  await confirmation.getByRole('button', { name: 'Enter confirmation code', exact: true }).waitFor();
  const before = await admin.auth.admin.getUserById(a.id); assert.ifError(before.error);
  check(!before.data.user.email_confirmed_at, 'opening/scanning the generic confirmation form does not confirm an account');
  const headers = (await confirmation.request.get(base + '/auth/confirm')).headers();
  check(headers['cache-control'].includes('no-store') && headers['cdn-cache-control'].includes('private, no-store') && headers['vercel-cdn-cache-control'].includes('private, no-store') && headers['referrer-policy'] === 'no-referrer', 'confirmation result forbids browser/shared caching and sends no-referrer');
  evidence.confirmationHeaders = { cache: headers['cache-control'], cdn: headers['cdn-cache-control'], vercel: headers['vercel-cdn-cache-control'], referrer: headers['referrer-policy'] };
  await enterConfirmation(confirmation,a.email,otp(a.html));
  await confirmation.getByRole('heading', { name: 'Email confirmed. You’re signed in.', exact: true }).waitFor();
  await a.dialog.waitFor({ state: 'hidden' });
  await a.page.locator('#desktop-profile-button').waitFor();
  check(true, 'confirmation code in another tab signs in and automatically closes matching original signup modal');
  await capture(confirmation, 'confirmation-success-phone', 390, 'light');
  await capture(confirmation, 'confirmation-success-desktop', 1440, 'dark');
  check(await confirmation.getByRole('heading', {name:/signed in/}).isVisible(), 'confirmation success remains understandable across theme/layout changes');
  const replayContext = await context(); const replay = await replayContext.newPage(); await replay.goto(link);
  await replay.waitForFunction(() => !location.hash && !location.search);
  check(!new URL(replay.url()).hash && !new URL(replay.url()).search, 'legacy confirmation secret is removed from visible URL/history');
  await replay.getByRole('button', { name: 'Confirm email and sign in', exact: true }).click();
  await replay.getByRole('alert').filter({ hasText: 'already used' }).waitFor();
  const denied = await replay.evaluate(async () => (await fetch('/api/auth/me')).status);
  check(denied === 401, 'replayed confirmation cannot create a session in another browser');

  const codeContext = await context(); const b = await signup(codeContext, 'emailb');
  await b.dialog.getByLabel('Email verification code', { exact: true }).fill(otp(b.html));
  await b.dialog.getByRole('button', { name: 'Verify email and sign in', exact: true }).click();
  await b.dialog.waitFor({ state: 'hidden' });
  check((await publicClient().auth.signInWithPassword({ email: b.email, password })).error === null, 'confirmation code verifies original signup without clicking a link');

  const raceContext=await context();const race=await signup(raceContext,'coderace');
  const confirmations=await Promise.all([publicClient(),publicClient()].map(client=>client.auth.verifyOtp({email:race.email,token:otp(race.html),type:'email'})));
  evidence.concurrentConfirmation=confirmations.map(result=>({success:!result.error,code:result.error?.code,status:result.error?.status}));
  console.log(JSON.stringify({concurrentConfirmation:evidence.concurrentConfirmation}));
  const successes=confirmations.filter(result=>!result.error);
  check(successes.length>=1 && successes.every(result=>result.data.user?.id===race.id), 'concurrent confirmations authenticate only the code owner');
  // GoTrue may admit both in-flight verifications before either clears the
  // token. Record that provider limitation; do not promise an atomic global
  // one-browser lock that this application does not implement.
  check(Boolean((await publicClient().auth.verifyOtp({email:race.email,token:otp(race.html),type:'email'})).error), 'confirmation replay is rejected after concurrent requests finish');

  const phoneSignupContext = await context(); const phoneSignup = await signup(phoneSignupContext, 'phone');
  const phoneContext = await context(); const phonePage = await phoneContext.newPage();
  await phonePage.goto(base + '/auth/confirm');
  await enterConfirmation(phonePage,phoneSignup.email,otp(phoneSignup.html));
  await phonePage.getByRole('heading', {name:'Email confirmed. You’re signed in.',exact:true}).waitFor();
  check(await phoneSignup.dialog.isVisible() && await phoneSignup.page.evaluate(async () => (await fetch('/api/auth/me')).status) === 401, 'confirmation on a separate device/browser does not silently authenticate the original device');

  const recoveryContext = await context(); const recovery = await recoveryContext.newPage();
  let updates = 0;
  recovery.on('request', req => { if (req.method() === 'PUT' && req.url().startsWith(api + '/auth/v1/user')) updates++; });
  await recovery.goto(base + '/reset-password');
  await recovery.getByPlaceholder('Email', { exact: true }).fill(a.email);
  await recovery.getByRole('button', { name: 'Send recovery code', exact: true }).click();
  await recovery.getByRole('heading', { name: 'Enter your recovery code', exact: true }).waitFor();
  const recoveryMail = await message('Reset your VerdictGames password', a.email); const code = otp(recoveryMail);
  await capture(recovery, 'recovery-code-phone', 390, 'light');
  await capture(recovery, 'recovery-code-tablet', 768, 'dark');
  check(!recoveryMail.includes('/auth/v1/verify') && !recoveryMail.includes('token_hash='), 'recovery email uses a code rather than a consumable reset URL');
  const scanContext = await context(); const scan = await scanContext.newPage();
  // Read/opening the recovery email on another device grants no session.
  await scan.goto(base + '/reset-password');
  check(await scan.evaluate(async () => (await fetch('/api/auth/me')).status) === 401, 'opening recovery form on a separate browser does not sign in');
  await scan.getByPlaceholder('Email', {exact:true}).fill(a.email);
  await scan.getByRole('button', {name:'I already have a code',exact:true}).click();
  check(await scan.getByLabel('Email verification code', {exact:true}).isVisible(), 'another browser can enter an existing code without sending a new email');
  const wrong = String((Number(code[0]) + 1) % 10) + code.slice(1);
  await recovery.getByLabel('Email verification code', { exact: true }).fill(wrong);
  await recovery.getByRole('button', { name: 'Verify code and continue', exact: true }).click();
  await recovery.getByRole('alert').filter({ hasText: 'invalid or expired' }).waitFor();
  check(updates === 0 && !await recovery.getByLabel('New password', { exact: true }).count(), 'wrong recovery code cannot unlock password update');
  await recovery.getByLabel('Email verification code', { exact: true }).fill(code);
  await recovery.getByRole('button', { name: 'Verify code and continue', exact: true }).click();
  await recovery.getByLabel('New password', { exact: true }).waitFor();
  check(updates === 0, 'valid recovery code alone does not change password');
  await recovery.getByLabel('New password', { exact: true }).fill(replacement);
  await recovery.getByLabel('Confirm new password', { exact: true }).fill(replacement);
  await recovery.getByRole('button', { name: 'Update Password', exact: true }).click();
  await recovery.getByText("Password updated. You're signed in and ready to continue.", { exact: true }).waitFor();
  check(updates === 1, 'password changes only after explicit update submission');
  check(!(await publicClient().auth.signInWithPassword({ email: a.email, password: replacement })).error, 'new password successfully logs in');
  check(Boolean((await publicClient().auth.signInWithPassword({ email: a.email, password })).error), 'old password no longer logs in');
  check(Boolean((await publicClient().auth.verifyOtp({ email: a.email, token: code, type: 'recovery' })).error), 'recovery code is single-use');

  const expired = await admin.auth.admin.generateLink({ type: 'recovery', email: a.email }); assert.ifError(expired.error);
  await sql`update auth.users set recovery_sent_at=now()-interval '11 minutes' where id=${a.id}`;
  check(Boolean((await publicClient().auth.verifyOtp({ email: a.email, token: expired.data.properties.email_otp, type: 'recovery' })).error), 'expired recovery code is rejected by actual local Auth');

  // An old-style link already in an inbox must still work after app-first
  // rollout. Build it solely from this fresh local signup's own token.
  const legacyContext = await context(); const legacy = await signup(legacyContext, 'legacy');
  const parsed = new URL(await legacyConfirmationLink(legacy.id));
  const hash = new URLSearchParams(parsed.hash.slice(1)).get('token_hash');
  const redirect = new URL(base + '/api/auth/callback?next=%2Flibrary');
  const oldUrl = new URL(api + '/auth/v1/verify');
  oldUrl.searchParams.set('token', hash); oldUrl.searchParams.set('type', 'signup');
  oldUrl.searchParams.set('redirect_to', redirect.toString());
  await legacy.page.goto(oldUrl.toString());
  await legacy.page.waitForURL(base + '/library');
  await legacy.page.locator('#desktop-profile-button').waitFor();
  check(true, 'already-issued old confirmation URLs still exchange PKCE and preserve the destination');

  const missingContext = await context(); const missingPage = await missingContext.newPage();
  const missingEmail = `missing-${run}@example.test`;
  await missingPage.goto(base + '/reset-password');
  await missingPage.getByPlaceholder('Email', {exact:true}).fill(missingEmail);
  await missingPage.getByRole('button', {name:'Send recovery code',exact:true}).click();
  await missingPage.getByLabel('Email verification code', {exact:true}).waitFor();
  const [missing] = await sql`select count(*)::int as count from auth.users where email=${missingEmail}`;
  check(missing.count === 0 && await missingPage.getByText('If an account exists for that email, a recovery code is on its way.', {exact:true}).isVisible(), 'unknown-account recovery gives the same safe waiting state without creating an account');
  evidence.result = 'passed';
} finally {
  if (evidence.result !== 'passed') evidence.result = 'failed';
  evidence.recordedAt = new Date().toISOString();
  if (browser) await browser.close();
  // Exact local test identities only; no game/library/list fixtures are made.
  for (const email of emails) {
    const rows = await sql`select id from auth.users where email=${email}`;
    for (const row of rows) {
      await sql`delete from public.profiles where auth_id=${row.id}`;
      assert.ifError((await admin.auth.admin.deleteUser(row.id)).error);
    }
  }
  await sql.end(); evidence.cleaned = true;
  writeFileSync(`${output}/results.json`, JSON.stringify(evidence, null, 2));
}
