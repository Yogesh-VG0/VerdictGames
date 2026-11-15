// Read-only browser observations. Uses the already installed Playwright runtime.
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const output = 'output/playwright/refinement-research';
mkdirSync(output, { recursive: true });
const sites = [
  ['playnest', 'https://playnest.dev/games'], ['rawg', 'https://rawg.io/discover/popular-in-2025'],
  ['backloggd', 'https://backloggd.com/lists/'], ['igdb', 'https://www.igdb.com/'],
  ['steamgriddb', 'https://www.steamgriddb.com/'], ['opencritic', 'https://www.opencritic.com/'],
  ['metacritic', 'https://www.metacritic.com/game/'], ['steam', 'https://store.steampowered.com/search/'],
  ['steamdb', 'https://steamdb.info/'], ['letterboxd', 'https://letterboxd.com/lists/'],
  ['rawg-year', 'https://rawg.io/discover/best-of-the-year'], ['rawg-alltime', 'https://rawg.io/discover/all-time-top'],
];
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const results = [];
try {
  for (const [name, url] of sites) {
    const page = await context.newPage();
    const started = performance.now();
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);
      const observation = await page.evaluate(() => ({ title: document.title,
        text: document.body.innerText.slice(0, 14000),
        controls: [...document.querySelectorAll('select, input, [role="combobox"]')].slice(0, 35).map(el => ({ tag: el.tagName, label: el.getAttribute('aria-label') || el.getAttribute('placeholder'), options: el.tagName === 'SELECT' ? el.innerText : undefined })),
        images: [...document.images].filter(el => el.width > 80).slice(0, 12).map(el => ({ alt: el.alt, width: el.width, height: el.height, naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, fit: getComputedStyle(el).objectFit })),
      }));
      await page.screenshot({ path: `${output}/${name}.png`, timeout: 10000 });
      results.push({ name, url, status: response?.status(), elapsedMs: Math.round(performance.now() - started), ...observation });
      console.log(`${name}: ${response?.status()} ${observation.title}`);
    } catch (error) { results.push({ name, url, error: error.name }); console.log(`${name}: ${error.name}`); }
    await page.close();
    writeFileSync(`${output}/observations.json`, JSON.stringify(results, null, 2));
  }
} finally { await browser.close(); }
