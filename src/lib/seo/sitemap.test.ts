import { describe, expect, it } from 'vitest';
import { collectSitemapRows } from './sitemap';

describe('sitemap database pagination', () => {
  it('collects more than the default 1000-row API cap without missing rows', async () => {
    const catalog = Array.from({ length: 1881 }, (_, id) => ({ id }));
    const rows = await collectSitemapRows(async (offset, size) => catalog.slice(offset, offset + size));
    expect(rows).toEqual(catalog);
  });
  it('propagates failures rather than publishing a truncated sitemap', async () => {
    await expect(collectSitemapRows(async offset => { if (offset) throw new Error('database unavailable'); return [1, 2]; }, 2)).rejects.toThrow('database unavailable');
  });
});
