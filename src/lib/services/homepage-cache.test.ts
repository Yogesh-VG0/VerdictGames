import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ reads: 0, active: 0, peak: 0, rows: [] as Record<string, unknown>[] }));
vi.mock('@/lib/services/upcoming-snapshot', () => ({ readCachedUpcomingSnapshot: async () => ({ results: [] }) }));
vi.mock('@/lib/services/community-ranking', () => ({ readHomepageReleaseRanking: async () => null }));
vi.mock('@/lib/services/gx-feeds', () => ({ loadGXDeals: async () => [] }));
vi.mock('@/lib/supabase/public', () => ({ getPublicSupabase: () => ({ from: () => {
  const chain: Record<string, unknown> = {};
  for (const key of ['select', 'eq', 'not', 'neq', 'gte', 'lte', 'gt', 'order', 'limit', 'in', 'abortSignal']) {
    chain[key] = () => chain;
  }
  chain.then = async (resolve: (value: unknown) => unknown) => {
    state.reads++;
    state.peak = Math.max(state.peak, ++state.active);
    await delay(8);
    state.active--;
    return resolve({ data: state.rows, error: null });
  };
  return chain;
} }) }));

describe('homepage rail cache using the installed Next.js implementation', () => {
  it('reuses available rails during a fill and coalesces concurrent cold reads', async () => {
    const require = createRequire(import.meta.url);
    require('next/dist/server/node-environment');
    const { workAsyncStorage } = require('next/dist/server/app-render/work-async-storage.external');
    const { unstable_cache } = require('next/cache');
    const { fetchHomepageData, loadHomepageDataWithStatus } = await import('./homepage');
    const { withHomepageTimings } = await import('./homepage-timing');
    const fixture = JSON.parse(readFileSync(new URL('../../../scripts/fixtures/public-games.json', import.meta.url), 'utf8'));
    state.rows = fixture.slice(0, 24).map((entry: Record<string, unknown>) => ({
      ...entry,
      release_date: new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10),
    }));
    const entries = new Map<string, { value: unknown; isStale: boolean }>();
    const incrementalCache = {
      generateSimpleCacheKey: async (key: string) => key,
      get: async (key: string) => entries.get(key) ?? null,
      set: async (key: string, value: unknown) => { entries.set(key, { value, isStale: false }); },
    };
    async function request<T>(read: () => Promise<T>) {
      const store: { route: string; incrementalCache: typeof incrementalCache; pendingRevalidates?: Record<string, Promise<unknown>> } = {
        route: '/api/homepage', incrementalCache,
      };
      const response = await workAsyncStorage.run(store, read) as T;
      await Promise.all(Object.values(store.pendingRevalidates ?? {}));
      return response;
    }

    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:1');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'isolated-test');
    try {
      const started = performance.now();
      const [cold, concurrent] = await Promise.all([request(loadHomepageDataWithStatus), request(loadHomepageDataWithStatus)]);
      const coldMs = performance.now() - started;
      const coldReads = state.reads;
      expect(cold).toEqual(concurrent);
      expect(cold.degraded).toBe(false);
      expect(cold.data.hero.length).toBeGreaterThan(0);
      expect(coldReads).toBeGreaterThan(0);
      expect(state.peak).toBeLessThanOrEqual(3);

      // Recreate PR #13's outer wrapper around the same assembled rails. Next
      // ignores their existing entries on this cold outer fill.
      const nested = unstable_cache(fetchHomepageData, ['replay-pr13-outer']);
      const baselineStarted = performance.now();
      expect(await request(nested)).toEqual(cold.data);
      const nestedMs = performance.now() - baselineStarted;
      expect(state.reads - coldReads).toBe(coldReads);

      const beforeHit = state.reads;
      const hitStarted = performance.now();
      const hit = await request(() => withHomepageTimings(async (header) => ({
        result: await loadHomepageDataWithStatus(), timing: header(),
      })));
      const warmRailsMs = performance.now() - hitStarted;
      expect(hit.result).toEqual(cold);
      expect(hit.timing).toContain('rail_hero;dur=');
      expect(hit.timing).not.toContain('refresh_hero');
      expect(state.reads).toBe(beforeHit);

      const heroKey = Array.from(entries.keys()).find(key => key.includes('homepage-hero-v6'))!;
      entries.delete(heroKey);
      expect(await request(loadHomepageDataWithStatus)).toEqual(cold);
      const heroOnlyReads = state.reads - beforeHit;
      expect(heroOnlyReads).toBeGreaterThan(0);
      expect(heroOnlyReads).toBeLessThan(coldReads);

      const beforeStale = state.reads;
      entries.get(heroKey)!.isStale = true;
      const stale = await request(() => withHomepageTimings(async (header) => ({
        result: await loadHomepageDataWithStatus(), timing: header(),
      })));
      expect(stale.result).toEqual(cold);
      expect(stale.timing).toMatch(/refresh_hero;dur=[\d.]+;desc="in-flight"/);
      expect(state.reads - beforeStale).toBe(heroOnlyReads);
      expect(entries.get(heroKey)?.isStale).toBe(false);

      if (process.env.HOMEPAGE_REPLAY_REPORT === '1') {
        console.info(JSON.stringify({ coldReads, nestedReads: coldReads, warmRailReads: 0, heroOnlyReads,
          coldMs: Math.round(coldMs), nestedMs: Math.round(nestedMs), warmRailsMs: Math.round(warmRailsMs), peakReads: state.peak }));
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
