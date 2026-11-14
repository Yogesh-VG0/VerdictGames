// Real local renders with public game metadata and disposable fixture records.
// Supply an existing Playwright runtime; no app dependency or production write.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

const phase = process.argv[2] ?? 'after';
const supplemental = process.argv.includes('--supplemental');
assert.ok(['before', 'after'].includes(phase));
const base = 'http://127.0.0.1:3100';
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, '127.0.0.1');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1 });
const ids = [], lists = [];
const stubProviderWidgets = page => page.route(url => /^\/api\/games\/[^/]+\/(news|achievements|steam-reviews|editorial|system-requirements)$/.test(url.pathname), route => {
  const endpoint = new URL(route.request().url()).pathname.split('/').at(-1);
  const data = endpoint === 'achievements' ? { title: '', achievements: [], total: 0 } : endpoint === 'news' ? { title: '', news: [] }
    : endpoint === 'steam-reviews' ? { reviews: [], total: 0 } : endpoint === 'system-requirements' ? null : [];
  return route.fulfill({ json: { success: true, data } });
});
const output = `docs/audits/2026-11-14/screenshots/${phase}`;
mkdirSync(output, { recursive: true });
let browser;
const contrast = (element, property) => {
  const style = getComputedStyle(element);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d');
  const color = value => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
  const luminance = values => values.slice(0, 3).map(value => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const bg = color(style.backgroundColor);
  const fg = color(property === 'placeholder' ? getComputedStyle(element, '::placeholder').color : style[property]);
  const composite = fg.map((value, i) => i < 3 ? value * fg[3] / 255 + bg[i] * (1 - fg[3] / 255) : 255);
  return (Math.max(luminance(composite), luminance(bg)) + 0.05) / (Math.min(luminance(composite), luminance(bg)) + 0.05);
};
try {
  const columns = new Set((await sql`select column_name from information_schema.columns where table_schema='public' and table_name='games'`).map(row => row.column_name));
  const source = JSON.parse(readFileSync('scripts/fixtures/public-games.json', 'utf8'));
  const games = source.map((game, index) => ({ ...Object.fromEntries(Object.entries(game).filter(([key]) => columns.has(key))),
    id: randomUUID(), slug: `ux-fixture-${game.slug}`, featured: index < 6, trending: index < 6,
    last_enriched_at: new Date().toISOString() }));
  if (phase === 'after') games.push({ ...games[0], id: randomUUID(), slug: 'ux-fixture-missing-art', title: 'A Very Long Adventure Title: The Complete Collector’s Edition', cover_image: '', header_image: '', screenshots: [], featured: false, trending: false });
  assert.equal((await admin.from('games').select('id').in('slug', games.map(g => g.slug))).data?.length, 0, 'Never overwrite an existing record');
  const inserted = await admin.from('games').insert(games).select('id');
  assert.ifError(inserted.error); ids.push(...inserted.data.map(g => g.id));
  const list = await admin.from('lists').insert({ slug: `ux-fixture-${randomUUID()}`, title: 'Stories worth your time',
    description: 'Narrative adventures from the editorial catalogue.', curated_by: 'Verdict Games', is_public: true }).select('id').single();
  assert.ifError(list.error); lists.push(list.data.id);
  assert.ifError((await admin.from('list_items').insert(ids.slice(0, 4).map((game_id, position) => ({ list_id: list.data.id, game_id, position })))).error);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const metrics = [];
  for (const theme of ['dark', 'light']) for (const [width, height] of (supplemental ? [] : [[390, 844], [768, 1024], [1440, 1000]])) {
    const context = await browser.newContext({ viewport: { width, height }, extraHTTPHeaders: { 'x-forwarded-for': `127.5.${theme === 'dark' ? 1 : 2}.${width % 250}` } });
    await context.addInitScript(theme => { localStorage.setItem('vg-theme', theme); }, theme);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // This visual suite does not test upstream provider APIs. Keep them out of
    // the run rather than consuming provider quota or mistaking outages for UI.
    await stubProviderWidgets(page);
    for (const [name, route] of [['home', '/'], ['game', '/game/ux-fixture-hades'], ['search', '/search?q=Hades'], ['explore', '/explore'], ['calendar', '/calendar?month=2026-11'], ['reviews', '/reviews'], ['lists', '/lists'], ['compare', '/compare?g1=ux-fixture-hades'], ['library', '/library']]) {
      const start = Date.now();
      await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.locator('main').waitFor();
      await page.locator('h1,h2').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(350);
      const data = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
        title: document.querySelector('h1,h2')?.textContent, searches: [...document.querySelectorAll('input[type=search]')].filter(e => e.getBoundingClientRect().width > 0).length,
        headerRight: Math.max(...[...document.querySelectorAll('header a,header button,header input')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.getBoundingClientRect().right)),
        headingOpacity: getComputedStyle(document.querySelector('h1,h2')).opacity }));
      metrics.push({ name, theme, width, elapsedToRenderMs: Date.now() - start, ...data });
      await page.screenshot({ path: `${output}/${name}-${theme}-${width}.png` });
      if (phase === 'after') {
        assert.equal(data.overflow, false, `${name}/${theme}/${width}: horizontal overflow`);
        assert.ok(data.headerRight <= width + 1, `${name}/${theme}/${width}: header controls offscreen`);
        if (name === 'search') assert.equal(data.searches, 1, 'Search page has one visible search context');
        if (name === 'search') {
          const field = page.getByRole('searchbox', { name: 'Search games', exact: true });
          for (const [property, minimum] of [['borderTopColor', 3], ['color', 4.5], ['placeholder', 4.5]]) {
            const ratio = await field.evaluate(contrast, property);
            metrics.push({ name: 'contrast', theme, width, property, ratio });
            assert.ok(ratio >= minimum, `${theme} search ${property}: ${ratio.toFixed(2)} contrast`);
          }
          if (width === 390) {
            await page.getByRole('button', { name: 'Filters and sorting', exact: false }).click();
            const platform = page.getByRole('radiogroup', { name: 'Platform', exact: true });
            await platform.getByRole('radio', { checked: true }).focus();
            await page.keyboard.press('ArrowRight');
            assert.equal(await platform.getByRole('radio', { name: 'PC', exact: true }).getAttribute('aria-checked'), 'true');
            await page.getByRole('button', { name: 'Filters and sorting', exact: false }).click();
          }
        }
        if (name === 'compare') {
          await page.getByRole('region', { name: 'Selected comparison game' }).getByRole('heading', { name: 'Hades', exact: true }).waitFor();
          const second = page.getByRole('combobox', { name: 'Search second game...' });
          await second.fill('Baldur');
          await page.getByRole('option').first().waitFor();
          await second.press('ArrowDown'); await second.press('Enter');
          await page.getByText('Verdict Score', { exact: true }).waitFor();
          assert.ok(page.url().includes('g2='), 'Keyboard comparison selection persists in URL');
        }
        if (name === 'game' && width === 390) {
          const trailer = page.getByRole('button', { name: 'Play Hades trailer', exact: true });
          await trailer.scrollIntoViewIfNeeded();
          await trailer.locator('img').first().waitFor();
          await page.screenshot({ path: `${output}/trailer-${theme}-390.png` });
        }
        if (name === 'library') {
          const trigger = page.getByRole('button', { name: 'Sign In to Get Started' });
          assert.ok(await trigger.evaluate(contrast, 'color') >= 4.5, 'Primary action text contrast');
          await trigger.click();
          const dialog = page.getByRole('dialog');
          await dialog.waitFor();
          await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement));
          assert.ok(await dialog.evaluate(node => node.contains(document.activeElement)), 'Auth captures focus');
          await page.keyboard.press('Shift+Tab');
          assert.ok(await dialog.evaluate(node => node.contains(document.activeElement)), 'Auth traps keyboard focus');
          await dialog.evaluate(node => {
            const elements = [...node.querySelectorAll('a[href],button:not([disabled]),input:not([disabled])')].filter(el => el.getClientRects().length);
            elements.at(-1)?.focus();
          });
          await page.keyboard.press('Tab');
          assert.equal(await dialog.evaluate(node => node.querySelector('button:not([disabled])') === document.activeElement), true, 'Last-to-first auth focus wrap');
          await page.keyboard.press('Shift+Tab');
          assert.ok(await dialog.evaluate(node => node.contains(document.activeElement)), 'First-to-last auth focus wrap');
          await page.waitForFunction(() => {
            const node = document.querySelector('[role="dialog"]');
            return node && Number(getComputedStyle(node).opacity) >= 0.999 && Number(getComputedStyle(node.parentElement).opacity) >= 0.999;
          });
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
        if (name === 'calendar') {
          assert.equal(await page.getByText(/ROG:.*campaign|ProArt Masters Talks|ASUS OLED campaign/i).count(), 0, 'Calendar excludes known non-game advertising');
          const month = page.locator('button[data-active]').last();
          await month.focus();
          const rect = await month.boundingBox();
          assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width + 1, 'Final month is fully reachable');
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
  if (phase === 'after') {
    const sitemap = await fetch(base + '/sitemap.xml');
    assert.equal(sitemap.status, 200, 'Local sitemap loads with restricted profile privileges');
    const xml = await sitemap.text();
    for (const game of games.slice(0, 7)) assert.ok(xml.includes(`/game/${game.slug}</loc>`), `Eligible fixture ${game.slug} is in sitemap`);
    // This unchanged public-safety fixture has a Nudity tag. Preserve the
    // existing filter rather than weakening it to make a sitemap assertion pass.
    assert.ok(!xml.includes('/game/ux-fixture-grand-theft-auto-vi</loc>'), 'Safety-excluded fixture stays out of sitemap');
    assert.ok(!xml.includes('/library</loc>') && !xml.includes('/settings</loc>'), 'Private account routes stay out of sitemap');
    for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, extraHTTPHeaders: { 'x-forwarded-for': `127.6.${theme === 'dark' ? 1 : 2}.1` } });
      await context.addInitScript(theme => localStorage.setItem('vg-theme', theme), theme);
      const page = await context.newPage();
      await stubProviderWidgets(page);
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.getByText('Autoplay off · reduced motion', { exact: true }).waitFor();
      const title = await page.locator('h1').textContent();
      await page.waitForTimeout(6300);
      assert.equal(await page.locator('h1').textContent(), title, 'Reduced-motion hero does not auto-advance');
      const activeAnimations = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().duration > 1).length);
      assert.equal(activeAnimations, 0, 'No running CSS/WAAPI animations in reduced-motion homepage');
      await page.goto(base + '/game/ux-fixture-missing-art', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'A Very Long Adventure Title: The Complete Collector’s Edition', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Missing artwork and long title fit');
      await page.screenshot({ path: `${output}/missing-art-${theme}-390.png` });
      await page.goto(base + '/search?q=Hades', { waitUntil: 'domcontentloaded' });
      await page.route('**/api/search?*', async route => { await new Promise(resolve => setTimeout(resolve, 650)); await route.fulfill({ status: 503, json: { success: false, error: 'Simulated local provider outage' } }); });
      await page.getByRole('searchbox', { name: 'Search games', exact: true }).fill('local-outage-fixture');
      await page.getByRole('status', { name: 'Loading games' }).waitFor();
      await page.getByText('Browse results are temporarily unavailable', { exact: true }).waitFor();
      await page.screenshot({ path: `${output}/search-error-${theme}-390.png` });
      await page.unroute('**/api/search?*');
      await page.getByRole('searchbox', { name: 'Search games', exact: true }).fill('Hades');
      await page.locator('main a[href="/game/ux-fixture-hades"]').first().waitFor();
      const slowRoute = url => url.pathname === '/game/ux-fixture-hades' && url.searchParams.has('_rsc');
      await page.route(slowRoute, async route => { await new Promise(resolve => setTimeout(resolve, 800)); await route.continue(); });
      await page.locator('main a[href="/game/ux-fixture-hades"]').first().click();
      await page.getByText('Loading page…', { exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Hades', exact: true }).waitFor();
      await page.unroute(slowRoute);
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(base + '/game/ux-fixture-clair-obscur-expedition-33', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: /Clair Obscur/, level: 1 }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(theme => document.documentElement.classList.contains('light') === (theme === 'light'), theme);
      await page.waitForTimeout(350);
      await page.getByAltText('Clair Obscur: Expedition 33', { exact: true }).first().evaluate(image => image.decode());
      await page.screenshot({ path: `${output}/clair-hero-${theme}-768.png` });
      console.log(`PASS ${theme}: explicit reduced motion, missing artwork/long title, slow search and outage recovery`);
      await context.close();
    }
    for (const width of [320, 820, 1024, 1100]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      await page.goto(base + '/search?q=Hades', { waitUntil: 'domcontentloaded' });
      const bounds = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, right: Math.max(...[...document.querySelectorAll('header a,header button,header input')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.getBoundingClientRect().right)) }));
      assert.ok(!bounds.overflow && bounds.right <= width + 1, `${width}: responsive header and search fit`);
      await page.screenshot({ path: `${output}/search-dark-${width}.png` });
      await context.close();
    }
  }
  writeFileSync(`.verification/ux-${supplemental ? 'supplemental' : phase}.json`, JSON.stringify(metrics, null, 2));
  console.log(supplemental ? 'PASS supplemental scenarios and eligible sitemap coverage' : `PASS ${phase}: 54 real page renders captured; no uncaught JavaScript errors`);
} finally {
  await browser?.close();
  for (const id of lists) assert.ifError((await admin.from('lists').delete().eq('id', id)).error);
  for (const id of ids) assert.ifError((await admin.from('games').delete().eq('id', id)).error);
  await sql.end();
}
