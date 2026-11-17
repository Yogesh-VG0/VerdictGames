import { describe, expect, it, vi } from 'vitest';
import { admitCataloguePayload, coalesceCatalogueRead, IncompleteCatalogueRead, readCachedCatalogue } from './cached-catalogue';

describe('catalogue cache admission', () => {
  it('shares concurrent fixed public work but reads again after it settles', async () => {
    let finish!: (value: string[]) => void;
    const read = vi.fn(() => new Promise<string[]>(resolve => { finish = resolve; }));
    const shared = coalesceCatalogueRead(read);
    const a = shared(), b = shared();
    await Promise.resolve();
    expect(read).toHaveBeenCalledTimes(1);
    finish(['public game']);
    expect(await Promise.all([a, b])).toEqual([['public game'], ['public game']]);
    const next = shared(); await Promise.resolve();
    expect(read).toHaveBeenCalledTimes(2);
    finish(['fresh game']); expect(await next).toEqual(['fresh game']);
  });
  it('releases failed work for recovery and keeps distinct public snapshots separate', async () => {
    const error = new Error('Database unavailable');
    const read = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(['recovered']);
    const shared = coalesceCatalogueRead(read);
    const results = await Promise.allSettled([shared(), shared()]);
    expect(results).toEqual([{ status: 'rejected', reason: error }, { status: 'rejected', reason: error }]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(await shared()).toEqual(['recovered']);
    expect(await coalesceCatalogueRead(async () => ['another snapshot'])()).toEqual(['another snapshot']);
  });
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
