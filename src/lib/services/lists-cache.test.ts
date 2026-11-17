import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ args: [] as unknown[][], read: vi.fn() }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: (...args: unknown[]) => unknown) => (...args: unknown[]) => {
  state.args.push(args);
  return fn(...args);
} }));
vi.mock('@/lib/supabase/public', () => ({ getPublicSupabase: () => ({ from: () => {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'range', 'abortSignal']) query[method] = () => query;
  query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => state.read().then(resolve, reject);
  return query;
} }) }));
import { loadPublicListSummaries } from './lists';

describe('public collection overview cache', () => {
  beforeEach(() => { state.args.length = 0; state.read.mockReset(); });
  it('normalizes SSR/API defaults and shares pending anonymous overview work only', async () => {
    let finish!: (value: unknown) => void;
    state.read.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const a = loadPublicListSummaries(1), b = loadPublicListSummaries(1, undefined, 'all');
    await vi.waitFor(() => expect(state.read).toHaveBeenCalledTimes(1));
    expect(state.args).toEqual([[1, null, 'all'], [1, null, 'all']]);
    expect(state.read).toHaveBeenCalledTimes(1);
    finish({ data: [], error: null });
    expect(await a).toEqual(await b);
    state.read.mockResolvedValue({ data: [], error: null });
    await loadPublicListSummaries(1);
    expect(state.read).toHaveBeenCalledTimes(2);
  });
  it('rejects failed refreshes, releases pending work and allows recovery', async () => {
    state.read.mockResolvedValueOnce({ data: null, error: new Error('Database unavailable') });
    const results = await Promise.allSettled([loadPublicListSummaries(), loadPublicListSummaries()]);
    expect(results.every(result => result.status === 'rejected')).toBe(true);
    expect(state.read).toHaveBeenCalledTimes(1);
    state.read.mockResolvedValue({ data: [], error: null });
    expect((await loadPublicListSummaries()).items).toEqual([]);
    expect(state.read).toHaveBeenCalledTimes(2);
  });
  it('keeps owner, kind and page variants distinct from the shared overview', async () => {
    state.read.mockResolvedValue({ data: [], error: null });
    await Promise.all([loadPublicListSummaries(), loadPublicListSummaries(2), loadPublicListSummaries(1, 'owner'), loadPublicListSummaries(1, undefined, 'editorial')]);
    expect(state.read).toHaveBeenCalledTimes(4);
    expect(state.args).toContainEqual([2, null, 'all']);
    expect(state.args).toContainEqual([1, 'owner', 'all']);
    expect(state.args).toContainEqual([1, null, 'editorial']);
  });
});
