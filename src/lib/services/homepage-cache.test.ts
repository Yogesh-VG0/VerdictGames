import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it, vi } from 'vitest';
import { currentHomepageSignal } from './homepage-budget';

const state = vi.hoisted(() => ({ reads: 0, active: 0, peak: 0, aborted: 0, stall: false, dealsReads: 0, widerReads: 0, olderRows: [] as Record<string, unknown>[], rows: [] as Record<string, unknown>[] }));
vi.mock('@/lib/services/upcoming-snapshot', () => ({ readCachedUpcomingSnapshot: async () => ({ results: [] }) }));
vi.mock('@/lib/services/community-ranking', () => ({ readHomepageReleaseRanking: async () => null }));
vi.mock('@/lib/services/gx-feeds', () => ({ GX_FEEDS_API_CACHE_CONTROL: 's-maxage=300', loadHomepageDeals: async () => {
  state.dealsReads++;
  throw new Error('Deals snapshot unavailable');
} }));
vi.mock('@/lib/supabase/public', () => ({ getPublicSupabase: () => ({ from: () => {
  const chain: Record<string, unknown> = {};
  let older = false;
  chain.lt = () => { older = true; return chain; };
  for (const key of ['select', 'eq', 'not', 'neq', 'gte', 'lte', 'gt', 'order', 'limit', 'in', 'or', 'abortSignal']) {
    chain[key] = () => chain;
  }
  chain.then = async (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
    state.reads++;
    state.peak = Math.max(state.peak, ++state.active);
    try {
      await delay(state.stall ? 30_000 : 8, undefined, { signal: currentHomepageSignal() });
      if (older) state.widerReads++;
      return resolve({ data: older ? state.olderRows : state.rows, error: null });
    } catch (error) {
      state.aborted++;
      return reject(error);
    } finally {
      state.active--;
    }
  };
  return chain;
} }) }));

describe('homepage rail cache using the installed Next.js implementation', () => {
  it('widens a populated raw hero pool only when too few games qualify', async () => {
    createRequire(import.meta.url)('next/dist/server/node-environment');
    const { fetchHeroCandidates } = await import('./homepage');
    const [fixture] = JSON.parse(readFileSync(new URL('../../../scripts/fixtures/public-games.json', import.meta.url), 'utf8'));
    const rows = Array.from({ length: 7 }, (_, index) => ({
      ...fixture, id: String(index), steam_app_id: index + 1,
      slug: `sample-game-${index}`, title: `Sample Game ${index}`,
      release_date: new Date(Date.now() - (index === 6 ? 900 : 30) * 86400000).toISOString().slice(0, 10),
      release_status: 'released', current_players: 8000,
    }));
    try {
      state.rows = rows.slice(0, 6).map((row, index) => index < 5 ? row : { ...row, header_image: row.cover_image });
      state.olderRows = [rows[6]];
      expect((await fetchHeroCandidates()).map(game => game.slug)).toContain(rows[6].slug);
      expect(state.widerReads).toBe(1);
      state.rows = rows.slice(0, 6);
      expect(await fetchHeroCandidates()).toHaveLength(6);
      expect(state.widerReads).toBe(1);
    } finally {
      state.rows = [];
      state.olderRows = [];
      state.reads = state.peak = state.widerReads = 0;
    }
  });

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

      const heroKey = Array.from(entries.keys()).find(key => key.includes('homepage-hero-v9'))!;
      expect(heroKey).toBe('function () { [native code] }-homepage-hero-v9-[]');
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

      expect(cold.data.deals).toEqual([]);
      expect(state.dealsReads).toBe(0);
      const { GET } = await import('@/app/api/gx/deals/snapshot/route');
      const unavailable = await GET();
      expect(unavailable.status).toBe(503);
      expect(unavailable.headers.get('cache-control')).toContain('private, no-store');
      expect(unavailable.headers.get('cdn-cache-control')).toBe('private, no-store');
      expect(state.dealsReads).toBe(1);

      // All cold database work stalls. A shorter queued rail expires before
      // admission and active transports are cancelled without leaking slots.
      entries.clear();
      state.stall = true;
      const beforeStall = state.reads;
      const pressureStarted = performance.now();
      const pressure = await request(loadHomepageDataWithStatus);
      expect(performance.now() - pressureStarted).toBeLessThan(11_000);
      expect(pressure.degraded).toBe(true);
      expect(pressure.data.hero).toEqual([]);
      expect(state.reads - beforeStall).toBe(state.aborted);
      expect(state.active).toBe(0);
      expect(state.peak).toBeLessThanOrEqual(3);
      expect([...entries.keys()].some(key => key.includes('homepage-hero-v9'))).toBe(false);

      state.stall = false;
      expect(await request(loadHomepageDataWithStatus)).toEqual(cold);
    } finally {
      vi.unstubAllEnvs();
    }
  }, 18_000);
});
