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
    const game = await admin.from('games').insert({ slug: `browser-fixture-${run}-${label.toLowerCase()}`, title: identity.title,
      cover_image: '/icon.png', platforms: ['PC'], genres: ['Adventure'], release_date: '2025-01-01' }).select('id').single();
    assert.ifError(game.error);
    games.push(game.data.id);
    assert.ifError((await admin.from('user_games').insert({ user_id: identity.profileId, game_id: game.data.id,
      status: 'playing', notes: `Local private ${label}` })).error);
  }
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('http://127.0.0.1:3100/library');
  for (const [index, identity] of users.entries()) {
    await page.getByRole('button', { name: 'Sign In to Get Started' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Email', { exact: true }).fill(identity.email);
    await dialog.getByLabel('Password', { exact: true }).fill(identity.password);
    await dialog.locator('button[type="submit"]').click();
    await page.locator('#desktop-profile-button').waitFor();
    await page.getByText(identity.title, { exact: true }).waitFor();
    assert.equal(await page.getByText(users[1 - index].title, { exact: true }).count(), 0, 'Previous/other identity library must not render');
    const own = await page.evaluate(async () => (await (await fetch('/api/auth/me')).json()).data.id);
    assert.equal(own, identity.id, 'Browser cookie session must match current identity');
    await page.waitForFunction(() => [...document.querySelectorAll('.page-enter')].every(el => Number(getComputedStyle(el).opacity) > 0.99));
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
    });
    await page.screenshot({ path: `${output}/privacy-library-${index === 0 ? 'a' : 'b'}.png`, fullPage: true });
    await page.locator('#desktop-profile-button').click();
    await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
    await page.getByRole('dialog', { name: 'Sign Out?' }).getByRole('button', { name: 'Sign Out', exact: true }).click();
    await page.getByRole('button', { name: 'Sign In to Get Started' }).waitFor();
    assert.equal(await page.getByText(identity.title, { exact: true }).count(), 0, 'Private library must disappear on logout');
  }
  assert.deepEqual(pageErrors, [], 'No browser JavaScript errors');
  console.log('PASS browser login A → logout → login B → logout, same page, isolated libraries and verified cookies');
  console.log('PASS signed-out state restored and no browser JavaScript errors');
} finally {
  await browser?.close();
  const failures = [];
  for (const id of games) if ((await admin.from('games').delete().eq('id', id)).error) failures.push('game');
  for (const user of users) if ((await admin.auth.admin.deleteUser(user.id)).error) failures.push('user');
  assert.deepEqual(failures, [], 'Disposable browser fixtures cleaned up');
}
