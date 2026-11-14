// Uses an already installed Playwright runtime; no application dependency is
// added. Pass PLAYWRIGHT_MODULE_PATH to that runtime's index.mjs.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, '127.0.0.1');
assert.ok(process.env.PLAYWRIGHT_MODULE_PATH, 'An existing Playwright runtime is required');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const users = [];
const games = [];
const maintenanceIds = [];
let browser;
const run = randomUUID().replaceAll('-', '').slice(0, 10);
const output = 'docs/audits/2026-11-14/screenshots';
mkdirSync(output, { recursive: true });

try {
  for (const label of ['A', 'B']) {
    const email = `browser-${run}-${label.toLowerCase()}@example.test`;
    const password = `Local-${randomBytes(20).toString('hex')}!`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true,
      user_metadata: { preferred_username: `browser_${run}_${label.toLowerCase()}`, full_name: `Local Player ${label}` } });
    assert.ifError(error);
    const identity = { id: data.user.id, email, password, title: `Ownership Adventure ${label}` };
    users.push(identity);
    const profile = await admin.from('profiles').select('id').eq('auth_id', identity.id).single();
    assert.ifError(profile.error);
    identity.profileId = profile.data.id;
    if (label === 'A') assert.ifError((await admin.from('profiles').update({ role: 'admin' }).eq('id', identity.profileId)).error);
    const game = await admin.from('games').insert({ slug: `browser-fixture-${run}-${label.toLowerCase()}`, title: identity.title,
      cover_image: '/icon.png', platforms: ['PC'], genres: ['Adventure'], release_date: '2025-01-01' }).select('id').single();
    assert.ifError(game.error);
    games.push(game.data.id);
    assert.ifError((await admin.from('user_games').insert({ user_id: identity.profileId, game_id: game.data.id,
      status: 'playing', notes: `Local private ${label}` })).error);
  }
  const history = await admin.from('scheduler_runs').insert([
    { job_name: 're-enrich', status: 'success', started_at: new Date(Date.now() - 3600000).toISOString(), finished_at: new Date(Date.now() - 3500000).toISOString(), metadata: { local_browser_run: run } },
    { job_name: 're-enrich', status: 'deferred', started_at: new Date().toISOString(), finished_at: new Date().toISOString(), metadata: { outcome: 'deferred', local_browser_run: run } },
  ]).select('id');
  assert.ifError(history.error);
  maintenanceIds.push(...history.data.map(row => row.id));
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  // Simulate a distinct local client so separate verification suites do not
  // share the proxy's per-IP bucket. The limiter remains fully enabled.
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: { 'x-forwarded-for': `127.2.${parseInt(run.slice(0, 2), 16)}.${parseInt(run.slice(2, 4), 16)}` } });
  const page = await context.newPage();
  const pageErrors = [];
  const authEvents = [];
  const consoleClasses = [];
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/auth/v1/') || ['/api/auth/me', '/api/auth/bootstrap'].includes(url.pathname))
      authEvents.push({ path: url.pathname, status: response.status() });
  });
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/api/auth/'))
      authEvents.push({ path: url.pathname, failure: request.failure()?.errorText });
  });
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    consoleClasses.push(/content security policy|connect-src/i.test(text) ? 'CSP' : /cors|cross-origin/i.test(text) ? 'CORS' : 'other');
  });
  let authProfileRequests = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/auth/me') authProfileRequests++; });
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('http://127.0.0.1:3100/library');
  let injectedProfileFailure = false;
  await page.route(url => url.pathname === '/api/auth/me', async route => {
    if (!injectedProfileFailure) {
      injectedProfileFailure = true;
      await route.fulfill({ status: 503, json: { success: false, error: 'Simulated local profile outage' } });
    } else await route.continue();
  });
  for (const [index, identity] of users.entries()) {
    await page.getByRole('button', { name: 'Sign In to Get Started' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Email', { exact: true }).fill(identity.email);
    await dialog.getByLabel('Password', { exact: true }).fill(identity.password);
    await dialog.locator('button[type="submit"]').click();
    try { await page.locator('#desktop-profile-button').waitFor(); }
    catch (error) {
      const alerts = (await page.getByRole('alert').allTextContents()).map(text => text
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[fixture email]')
        .replace(/eyJ[A-Za-z0-9_.-]+/g, '[redacted token]').slice(0, 300));
      console.error('Browser sign-in diagnostics:', JSON.stringify({ alerts, authEvents: authEvents.slice(-12), consoleClasses,
        cookieNames: (await context.cookies()).map(cookie => cookie.name) }));
      await page.screenshot({ path: `${output}/local-auth-failure.png` });
      throw error;
    }
    await page.getByText(identity.title, { exact: true }).waitFor();
    assert.equal(await page.getByText(users[1 - index].title, { exact: true }).count(), 0, 'Previous/other identity library must not render');
    const own = await page.evaluate(async () => (await (await fetch('/api/auth/me')).json()).data.id);
    assert.equal(own, identity.id, 'Browser cookie session must match current identity');
    await page.waitForFunction(() => [...document.querySelectorAll('.page-enter')].every(el => Number(getComputedStyle(el).opacity) > 0.99));
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
    });
    await page.screenshot({ path: `${output}/privacy-library-${index === 0 ? 'a' : 'b'}.png`, fullPage: true });
    if (index === 0) {
      await page.goto('http://127.0.0.1:3100/admin/scheduler');
      await page.getByText('Last success:', { exact: false }).first().waitFor();
      assert.ok(await page.getByText('deferred', { exact: true }).count() > 0, 'Deferred runs are visible in the actual dashboard');
      await page.screenshot({ path: `${output}/maintenance-deferred-local.png`, fullPage: true });
      await page.goto('http://127.0.0.1:3100/library');
      await page.getByText(identity.title, { exact: true }).waitFor();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.deepEqual(await page.getByRole('navigation', { name: 'Bottom navigation' }).locator('span').allTextContents(), ['Home', 'Explore', 'Search', 'Library', 'You'], 'Signed-in destinations stay stable');
    const you = page.getByRole('navigation', { name: 'Bottom navigation' }).getByRole('link', { name: 'You' });
    assert.ok((await you.getAttribute('href')).startsWith('/profile/'), 'You opens the authenticated profile');
    await page.screenshot({ path: `${output}/privacy-library-mobile-${index === 0 ? 'a' : 'b'}.png` });
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Menu' });
    await drawer.waitFor();
    assert.ok(await drawer.getByRole('link', { name: 'Settings', exact: true }).isVisible(), 'Signed-in tablet retains settings');
    await page.keyboard.press('Escape');
    await drawer.waitFor({ state: 'hidden' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    if (index === 1) {
      const profileEndpoint = url => url.pathname === '/api/auth/me';
      const outage = route => route.fulfill({ status: 503, json: { success: false, error: 'Simulated local profile outage' } });
      await page.route(profileEndpoint, outage);
      await page.reload();
      await page.getByRole('heading', { name: 'Your library is temporarily unavailable', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Sign In to Get Started' }).count(), 0, 'Active-session failure does not pretend the caller is signed out');
      assert.equal(await page.getByText(users[0].title, { exact: true }).count(), 0, 'Failed profile recovery cannot reveal the other library');
      await page.screenshot({ path: `${output}/privacy-profile-recovery-local.png` });
      await page.unroute(profileEndpoint, outage);
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.getByText(identity.title, { exact: true }).waitFor();
    }
    await page.locator('#desktop-profile-button').click();
    await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
    await page.getByRole('dialog', { name: 'Sign Out?' }).getByRole('button', { name: 'Sign Out', exact: true }).click();
    await page.getByRole('button', { name: 'Sign In to Get Started' }).waitFor();
    assert.equal(await page.getByText(identity.title, { exact: true }).count(), 0, 'Private library must disappear on logout');
  }
  assert.deepEqual(pageErrors, [], 'No browser JavaScript errors');
  assert.equal(injectedProfileFailure, true, 'Browser exercised real transient profile failure recovery');
  console.log('PASS browser login A → logout → login B → logout, same page, isolated libraries and verified cookies');
  console.log('PASS signed-out state restored and no browser JavaScript errors');
  console.log(`Measured own-profile requests during browser journey: ${authProfileRequests}`);
} finally {
  await browser?.close();
  const failures = [];
  if (maintenanceIds.length && (await admin.from('scheduler_runs').delete().in('id', maintenanceIds)).error) failures.push('maintenance');
  for (const id of games) if ((await admin.from('games').delete().eq('id', id)).error) failures.push('game');
  for (const user of users) if ((await admin.auth.admin.deleteUser(user.id)).error) failures.push('user');
  assert.deepEqual(failures, [], 'Disposable browser fixtures cleaned up');
}
