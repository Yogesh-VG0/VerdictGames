import { describe, expect, it } from 'vitest';
import { admitCataloguePayload, IncompleteCatalogueRead, readCachedCatalogue } from './cached-catalogue';

describe('catalogue cache admission', () => {
  it('does not mistake genuinely empty successful queries for outages', () => {
    const empty = { hero: [], topRated: [] };
    expect(admitCataloguePayload(empty, { hero: { status: 'fulfilled', value: [] } })).toBe(empty);
  });
  it('rejects a partially failed aggregate before it can replace a cached value', async () => {
    const partial = { hero: ['available'], topRated: [] };
    const read = async () => admitCataloguePayload(partial, {
      hero: { status: 'fulfilled', value: ['available'] },
      topRated: { status: 'rejected', reason: { code: '57014' } },
    });
    await expect(read()).rejects.toBeInstanceOf(IncompleteCatalogueRead);
    expect(await readCachedCatalogue(read, { hero: [], topRated: [] })).toEqual({ data: partial, degraded: true });
  });
  it('keeps normal successful reads eligible for public caching', async () => {
    expect(await readCachedCatalogue(async () => ['game'], [])).toEqual({ data: ['game'], degraded: false });
  });
  it('marks an unavailable cold cache as degraded rather than successful empty data', async () => {
    expect(await readCachedCatalogue(async () => { throw new Error('Database down'); }, [])).toEqual({ data: [], degraded: true });
  });
});
