import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  load: vi.fn(),
  cached: undefined as { value: unknown } | undefined,
  stale: false,
  refresh: undefined as Promise<unknown> | undefined,
}));
vi.mock('next/cache', () => ({
  unstable_cache: (read: () => Promise<unknown>, keys: string[]) => keys.some(key => key.startsWith('homepage-most-anticipated-')) ? async () => {
    const refresh = async () => {
      const value = await read();
      state.cached = { value };
      return value;
    };
    if (!state.cached) return refresh();
    if (state.stale) state.refresh = refresh().catch(() => undefined);
    return state.cached.value;
  } : read,
}));
vi.mock('@/lib/services/explore', () => ({ loadExplore: state.load }));

const now = Date.parse('2026-11-23T13:00:00Z');
const fetchedAt = new Date(now - 90 * 60000).toISOString();
const item = { rawgId: 973539, catalogueId: 'matched-fixture', slug: 'discovered-game', name: 'Discovered Game', released: '2027-03-31', tba: false, earlyAccess: false, image: null, added: 30, toplay: 7, genres: [] };
const snapshot = { items: [item], source: 'rawg', fetchedAt, degraded: false };
const unavailable = { data: [], fetchedAt: null, degraded: true };

describe('homepage discovery cache admission', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    state.load.mockReset();
    state.cached = undefined;
    state.stale = false;
    state.refresh = undefined;
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('caches a healthy dated snapshot, keeps verified identity and omits past releases', async () => {
    state.load.mockResolvedValue({
      ...snapshot,
      items: [item, { ...item, rawgId: 1, catalogueId: null },
        { ...item, rawgId: 2, released: '2026-11-22' }],
    });
    const { loadHomepageMostAnticipatedWithStatus: read } = await import('./homepage');
    const result = await read();
    expect(result).toMatchObject({
      fetchedAt, degraded: false,
      data: [{ name: 'Discovered Game', earlyAccess: true, releaseWindow: 'Mar 2027' }],
    });
    expect(await read()).toEqual(result);
    expect(state.load).toHaveBeenCalledTimes(1);
  });

  it('keeps a usable last-known-good cache value and its original timestamp after refresh fails', async () => {
    state.load.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({
      ...snapshot, degraded: true, items: [{ ...item, name: 'Unverified partial result' }],
    });
    const { loadHomepageMostAnticipatedWithStatus: read } = await import('./homepage');
    const original = await read();
    state.stale = true;
    expect(await read()).toEqual(original);
    await state.refresh;
    state.stale = false;
    expect(await read()).toEqual(original);
    vi.mocked(Date.now).mockReturnValue(now + 12 * 3600000);
    expect(await read()).toEqual(unavailable);
  });

  it('omits degraded, expired, and unavailable reads without admitting them to the cache', async () => {
    state.load.mockResolvedValueOnce({ ...snapshot, degraded: true })
      .mockResolvedValueOnce({ ...snapshot, fetchedAt: '2026-11-22T12:50:00Z' })
      .mockResolvedValueOnce({ ...snapshot, source: 'catalogue' })
      .mockRejectedValueOnce(new Error('Controlled database failure'))
      .mockResolvedValueOnce({ ...snapshot, items: [] });
    const { loadHomepageMostAnticipatedWithStatus: read } = await import('./homepage');
    for (let i = 0; i < 4; i++) {
      expect(await read()).toEqual(unavailable);
      expect(state.cached).toBeUndefined();
    }
    expect(await read()).toEqual({ data: [], fetchedAt, degraded: false });
    expect(await read()).toEqual({ data: [], fetchedAt, degraded: false });
    expect(state.load).toHaveBeenCalledTimes(5);
  });

  it('omits a timed-out read and prevents its late result from entering the cache', async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    let finish!: (value: typeof snapshot) => void;
    let started!: () => void;
    const startedReading = new Promise<void>(resolve => { started = resolve; });
    state.load.mockImplementation(() => {
      started();
      return new Promise<typeof snapshot>(resolve => { finish = resolve; });
    });
    const { loadHomepageMostAnticipatedWithStatus: read } = await import('./homepage');
    const pending = read();
    await startedReading;
    controller.abort(new DOMException('Controlled discovery timeout', 'TimeoutError'));
    expect(await pending).toEqual(unavailable);
    finish(snapshot);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(state.cached).toBeUndefined();
  });
});
