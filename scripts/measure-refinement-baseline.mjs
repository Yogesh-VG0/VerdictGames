import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { config } from 'dotenv';
config({ quiet: true });
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const output = 'output/playwright/refinement-before';
mkdirSync(output, { recursive: true });
const results = { measuredAt: new Date().toISOString(), requests: [], pages: [], provider: [] };
// Status, timing, response shape only. Never persist an authenticated provider URL.
for (const endpoint of process.argv.includes('--screens-only') ? [] : ['/games?page_size=1', '/games?search=Ananta&page_size=1']) {
  const started = performance.now();
  try {
    const url = new URL(`https://api.rawg.io/api${endpoint}`);
    url.searchParams.set('key', process.env.RAWG_API_KEY);
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const body = await response.text();
    let shape = 'non-json'; try { shape = Array.isArray(JSON.parse(body).results) ? 'results-array' : 'other-json'; } catch {}
    results.provider.push({ endpoint: endpoint.split('?')[0], status: response.status, elapsedMs: Math.round(performance.now() - started), shape });
  } catch (error) { results.provider.push({ endpoint: '/games', error: error.name, elapsedMs: Math.round(performance.now() - started) }); }
}
for (const route of process.argv.includes('--screens-only') ? [] : ['/api/lists', '/api/rawg/lists?type=best-of-year', '/api/auth/check-username?username=refinement_probe_2026']) {
  for (let i = 0; i < 3; i++) {
    const started = performance.now();
    const response = await fetch(`http://127.0.0.1:3200${route}`);
    const body = await response.text();
    results.requests.push({ route, sample: i + 1, status: response.status, bytes: Buffer.byteLength(body), elapsedMs: Math.round(performance.now() - started) });
    if (route.includes('rawg/lists') && response.ok) writeFileSync(`${output}/actual-anticipated.json`, body);
  }
}
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  for (const width of [1440, 768, 390]) for (const theme of ['dark', 'light']) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 } });
    await context.addInitScript(t => { localStorage.setItem('vg-theme', t); }, theme);
    const page = await context.newPage();
    for (const route of ['/lists', '/search?q=Hades']) {
      await page.goto(`http://127.0.0.1:3200${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${output}/${route.split('?')[0].slice(1)}-${theme}-${width}.png`, fullPage: true, timeout: 15000, animations: 'disabled' });
      results.pages.push({ route, width, theme, images: await page.locator('main img').evaluateAll(imgs => imgs.slice(0, 20).map(i => ({ alt: i.alt, src: i.currentSrc, width: i.width, height: i.height, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight }))).catch(() => []) });
    }
    await context.close();
  }
} finally { await browser.close(); writeFileSync(`${output}/${process.argv.includes('--screens-only') ? 'screenshots' : 'measurements'}.json`, JSON.stringify(results, null, 2)); }
