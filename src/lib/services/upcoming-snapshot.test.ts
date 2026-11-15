import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ stored: null as unknown, live: vi.fn() }));
vi.mock('@/lib/external/rawg', () => ({ getRawgUpcoming: state.live }));
vi.mock('@/lib/supabase/server', () => ({ getServerSupabase: () => ({ from: () => {
  const query: Record<string, unknown> = {};
  for (const method of ['select','eq','abortSignal']) query[method] = () => query;
  query.maybeSingle = async () => ({ data: state.stored, error: null });
  return query;
} }) }));
import { readUpcomingSnapshot } from './upcoming-snapshot';
const results = [{ id: 391403, name:'Path of Exile 2', slug:'path-of-exile-2', tba:false, released:'2026-12-11', added:537, ratings_count:67, rating:3.55, genres:[],tags:[],platforms:[] }];
describe('durable upcoming snapshot', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-only'); vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','http://127.0.0.1');
    state.stored = null; state.live.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());
  it('serves a fresh snapshot without contacting RAWG', async () => {
    state.stored = { payload: { results }, fetched_at: new Date().toISOString() };
    expect((await readUpcomingSnapshot()).results).toEqual(results);
    expect(state.live).not.toHaveBeenCalled();
  });
  it('preserves original freshness during indefinite downtime', async () => {
    state.stored = { payload: { results }, fetched_at:'2020-01-01T00:00:00Z' };
    state.live.mockRejectedValue(new Error('timeout'));
    expect(await readUpcomingSnapshot()).toEqual({ results, fetchedAt:'2020-01-01T00:00:00Z' });
  });
  it('does not replace a successful snapshot with an empty or malformed response', async () => {
    state.stored = { payload: { results }, fetched_at:'2020-01-01T00:00:00Z' };
    state.live.mockResolvedValue({ results: [] });
    expect((await readUpcomingSnapshot()).results).toEqual(results);
    state.live.mockResolvedValue({ results: [{ name:'wrong shape' }] });
    expect((await readUpcomingSnapshot()).results).toEqual(results);
  });
  it('uses fresh provider data on recovery and rejects an invalid cold read', async () => {
    state.live.mockResolvedValue({ results });
    expect((await readUpcomingSnapshot()).results).toEqual(results);
    state.live.mockResolvedValue({ results: [] });
    await expect(readUpcomingSnapshot()).rejects.toThrow('Invalid');
  });
});
