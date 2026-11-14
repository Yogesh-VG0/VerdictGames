// Real local renders with public game metadata and disposable fixture records.
// Supply an existing Playwright runtime; no app dependency or production write.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

const phase = process.argv[2] ?? 'after';
assert.ok(['before', 'after'].includes(phase));
const base = 'http://127.0.0.1:3100';
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, '127.0.0.1');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1 });
const ids = [], lists = [];
const output = `docs/audits/2026-11-14/screenshots/${phase}`;
mkdirSync(output, { recursive: true });
let browser;
try {
  const columns = new Set((await sql`select column_name from information_schema.columns where table_schema='public' and table_name='games'`).map(row => row.column_name));
  const source = JSON.parse(readFileSync('scripts/fixtures/public-games.json', 'utf8'));
  const games = source.map((game, index) => ({ ...Object.fromEntries(Object.entries(game).filter(([key]) => columns.has(key))),
    id: randomUUID(), slug: `ux-fixture-${game.slug}`, featured: index < 6, trending: index < 6,
    last_enriched_at: new Date().toISOString() }));
  assert.equal((await admin.from('games').select('id').in('slug', games.map(g => g.slug))).data?.length, 0, 'Never overwrite an existing record');
  const inserted = await admin.from('games').insert(games).select('id');
  assert.ifError(inserted.error); ids.push(...inserted.data.map(g => g.id));
  const list = await admin.from('lists').insert({ slug: `ux-fixture-${randomUUID()}`, title: 'Stories worth your time',
    description: 'Narrative adventures from the editorial catalogue.', curated_by: 'Verdict Games', is_public: true }).select('id').single();
  assert.ifError(list.error); lists.push(list.data.id);
  assert.ifError((await admin.from('list_items').insert(ids.slice(0, 4).map((game_id, position) => ({ list_id: list.data.id, game_id, position })))).error);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const metrics = [];
  for (const theme of ['dark', 'light']) for (const [width, height] of [[390, 844], [768, 1024], [1440, 1000]]) {
    const context = await browser.newContext({ viewport: { width, height }, extraHTTPHeaders: { 'x-forwarded-for': `127.5.${theme === 'dark' ? 1 : 2}.${width % 250}` } });
    await context.addInitScript(theme => { localStorage.setItem('vg-theme', theme); }, theme);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // This visual suite does not test upstream provider APIs. Keep them out of
    // the run rather than consuming provider quota or mistaking outages for UI.
    await page.route('**/api/games/*/{news,achievements,steam-reviews,editorial,system-requirements}', route => route.fulfill({ json: { success: true, data: [] } }));
    for (const [name, route] of [['home', '/'], ['game', '/game/ux-fixture-hades'], ['search', '/search?q=Hades'], ['explore', '/explore'], ['calendar', '/calendar?month=2026-11'], ['reviews', '/reviews'], ['lists', '/lists'], ['compare', '/compare?g1=ux-fixture-hades'], ['library', '/library']]) {
      const start = Date.now();
      await page.goto(base + route, { waitUntil: 'networkidle', timeout: 45000 });
      await page.locator('main').waitFor();
      await page.locator('h1,h2').first().waitFor();
      const data = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
        title: document.querySelector('h1,h2')?.textContent, searches: [...document.querySelectorAll('input[type=search]')].filter(e => e.getBoundingClientRect().width > 0).length,
        headerRight: Math.max(...[...document.querySelectorAll('header a,header button,header input')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.getBoundingClientRect().right)),
        headingOpacity: getComputedStyle(document.querySelector('h1,h2')).opacity }));
      metrics.push({ name, theme, width, elapsedToIdleMs: Date.now() - start, ...data });
      await page.screenshot({ path: `${output}/${name}-${theme}-${width}.png` });
      if (phase === 'after') {
        assert.equal(data.overflow, false, `${name}/${theme}/${width}: horizontal overflow`);
        assert.ok(data.headerRight <= width + 1, `${name}/${theme}/${width}: header controls offscreen`);
        if (name === 'search') assert.equal(data.searches, 1, 'Search page has one visible search context');
        if (name === 'compare') {
          await page.getByRole('region', { name: 'Selected comparison game' }).getByRole('heading', { name: 'Hades', exact: true }).waitFor();
          const second = page.getByRole('combobox', { name: 'Search second game...' });
          await second.fill('Baldur');
          await page.getByRole('option').first().waitFor();
          await second.press('ArrowDown'); await second.press('Enter');
          await page.getByText('Verdict Score', { exact: true }).waitFor();
          assert.ok(page.url().includes('g2='), 'Keyboard comparison selection persists in URL');
        }
        if (name === 'library') {
          const trigger = page.getByRole('button', { name: 'Sign In to Get Started' });
          await trigger.click();
          const dialog = page.getByRole('dialog');
          await dialog.waitFor();
          await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement));
          assert.ok(await dialog.evaluate(node => node.contains(document.activeElement)), 'Auth captures focus');
          await page.keyboard.press('Shift+Tab');
          assert.ok(await dialog.evaluate(node => node.contains(document.activeElement)), 'Auth traps keyboard focus');
          await page.screenshot({ path: `${output}/auth-${theme}-${width}.png` });
          await page.keyboard.press('Escape');
          await dialog.waitFor({ state: 'hidden' });
          await page.waitForFunction(() => document.activeElement?.textContent?.includes('Sign In to Get Started'));
          assert.equal(await trigger.evaluate(node => node === document.activeElement), true, 'Auth restores trigger focus');
        }
        if (name === 'explore') {
          const genre = page.getByRole('button', { name: 'Browse by Genre' });
          await genre.focus();
          const rect = await genre.boundingBox();
          assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width + 1, 'Final Explore chip reachable by keyboard');
        }
        if (width === 768 && name === 'home') {
          const menu = page.getByRole('button', { name: 'Open menu', exact: true });
          await menu.click();
          await page.getByRole('dialog', { name: 'Menu' }).waitFor();
          await page.keyboard.press('Escape');
          assert.equal(await menu.evaluate(node => node === document.activeElement), true, 'Tablet drawer restores focus');
        }
        if (width === 390) {
          assert.deepEqual(await page.getByRole('navigation', { name: 'Bottom navigation' }).locator('span').allTextContents(), ['Home', 'Explore', 'Search', 'Library', 'You']);
        }
      }
    }
    assert.deepEqual(errors, [], 'No uncaught UI errors');
    await context.close();
    console.log(`Rendered ${phase} ${theme} ${width}: nine routes`);
  }
  writeFileSync(`.verification/ux-${phase}.json`, JSON.stringify(metrics, null, 2));
  console.log(`PASS ${phase}: 54 real page renders captured; no uncaught JavaScript errors`);
} finally {
  await browser?.close();
  for (const id of lists) assert.ifError((await admin.from('lists').delete().eq('id', id)).error);
  for (const id of ids) assert.ifError((await admin.from('games').delete().eq('id', id)).error);
  await sql.end();
}
