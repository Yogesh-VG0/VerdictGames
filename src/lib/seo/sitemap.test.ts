import { describe, expect, it } from 'vitest';
import { collectSitemapRows, serializeSitemap } from './sitemap';

describe('sitemap database pagination', () => {
  it('collects more than the default 1000-row API cap without missing rows', async () => {
    const catalog = Array.from({ length: 1881 }, (_, id) => ({ id: String(id).padStart(6, '0') }));
    const cursors: Array<string | undefined> = [];
    const rows = await collectSitemapRows(async (after, size) => {
      cursors.push(after);
      return catalog.filter(row => after === undefined || row.id > after).slice(0, size);
    });
    expect(rows).toEqual(catalog);
    expect(cursors.slice(0, 3)).toEqual([undefined, '000249', '000499']);
  });
  it('propagates failures rather than publishing a truncated sitemap', async () => {
    await expect(collectSitemapRows(async after => { if (after) throw new Error('database unavailable'); return [{ id: 'a' }, { id: 'b' }]; }, 2)).rejects.toThrow('database unavailable');
  });
  it('rejects a repeated page rather than looping or duplicating URLs', async () => {
    await expect(collectSitemapRows(async () => [{ id: 'a' }], 1)).rejects.toThrow('cursor did not advance');
  });
  it('handles an empty catalog', async () => {
    expect(await collectSitemapRows(async () => [])).toEqual([]);
  });
});

describe('sitemap XML', () => {
  it('escapes URL delimiters and includes dates, frequency, and zero priority', () => {
    const xml = serializeSitemap([{ url: 'https://www.verdict.games/lists/a?x=1&y=2', lastModified: '2026-11-11', changeFrequency: 'weekly', priority: 0 }]);
    expect(xml).toContain('<loc>https://www.verdict.games/lists/a?x=1&amp;y=2</loc>');
    expect(xml).toContain('<lastmod>2026-11-11T00:00:00.000Z</lastmod>');
    expect(xml).toContain('<changefreq>weekly</changefreq><priority>0</priority>');
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });
});
