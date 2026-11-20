import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ directory: 0, hub: 0 }));
vi.mock('@/lib/supabase/public', () => ({ getPublicSupabase: () => ({ from: () => {
  let directory = false;
  let names: string[] = [];
  const query: Record<string, unknown> = {};
  for (const method of ['not', 'neq', 'order', 'limit', 'gt', 'abortSignal']) query[method] = () => query;
  query.select = (columns: string) => { directory = columns === 'developer'; return query; };
  query.in = (_column: string, values: string[]) => { names = values; return query; };
  query.then = (resolve: (value: unknown) => unknown) => {
    if (directory) {
      calls.directory++;
      return Promise.resolve({ data: ['North Studio', 'North-Studio', 'South Studio'].map(developer => ({ developer })), error: null }).then(resolve);
    }
    calls.hub++;
    return Promise.resolve({ data: names.map((name, index) => ({
      id: String(index), slug: name, title: name, developer: name, genres: ['Action'], platforms: ['PC'], tags: [],
      cover_image: 'https://images.igdb.com/cover.jpg', release_date: '2024-01-01', score: 80, review_count: 100,
    })), error: null }).then(resolve);
  };
  return query;
} }) }));

describe('developer directory cache', () => {
  it('reuses one directory across concurrent cold hubs without losing aliases', async () => {
    const require = createRequire(import.meta.url);
    require('next/dist/server/node-environment');
    const { workAsyncStorage } = require('next/dist/server/app-render/work-async-storage.external');
    const { loadDeveloperHub } = await import('./developers');
    const entries = new Map<string, unknown>();
    const incrementalCache = {
      generateSimpleCacheKey: async (key: string) => key,
      get: async (key: string) => entries.get(key) ?? null,
      set: async (key: string, value: unknown) => { entries.set(key, { value, isStale: false }); },
    };
    async function read(slug: string) {
      const store: { route: string; incrementalCache: typeof incrementalCache; pendingRevalidates?: Record<string, Promise<unknown>> } = {
        route: '/developers/[slug]', incrementalCache,
      };
      const result: Awaited<ReturnType<typeof loadDeveloperHub>> = await workAsyncStorage.run(store, () => loadDeveloperHub(slug));
      await Promise.all(Object.values(store.pendingRevalidates ?? {}));
      return result;
    }
    const [north, south] = await Promise.all([read('north-studio'), read('south-studio')]);
    expect(north?.games.map(game => game.title)).toEqual(['North Studio', 'North-Studio']);
    expect(south?.gameCount).toBe(1);
    expect(await read('north-studio')).toEqual(north);
    expect(await read('../invalid')).toBeNull();
    expect(calls).toEqual({ directory: 1, hub: 2 });
  });
});
