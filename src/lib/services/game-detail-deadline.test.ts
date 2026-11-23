import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
require('next/dist/server/node-environment');
const { workAsyncStorage } = require('next/dist/server/app-render/work-async-storage.external');
let getDetail: typeof import('@/app/api/games/[slug]/route').GET;
let NextRequest: typeof import('next/server').NextRequest;

const [game] = JSON.parse(readFileSync(new URL('../../../scripts/fixtures/public-games.json', import.meta.url), 'utf8'));
const start = Date.UTC(2026, 10, 24);
const fixtureOrigin = 'http://127.0.0.1:1';
const entries = new Map<string, { value: unknown; isStale: boolean }>();
const incrementalCache = {
  generateSimpleCacheKey: async (key: string) => key,
  get: async (key: string) => entries.get(key) ?? null,
  set: async (key: string, value: unknown) => { entries.set(key, { value, isStale: false }); },
};

type Reply = { after: number; status?: number };

function useTransport(...replies: Reply[]) {
  const attempts: Array<{ started: number; ended?: number; retry: string | null }> = [];
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const headers = new Headers(init?.headers);
    if (url.origin !== fixtureOrigin || headers.has('cookie')) {
      throw new Error('Unexpected origin or cookie in isolated public transport');
    }
    if (url.pathname === '/rest/v1/mobile_store_listings') return Promise.resolve(Response.json([]));
    if (url.pathname !== '/rest/v1/games' || url.searchParams.get('slug') !== 'eq.hades') {
      throw new Error('Unexpected lookup in isolated slug transport');
    }

    const reply = replies.shift();
    if (!reply) throw new Error('Unexpected game lookup attempt');
    const attempt: typeof attempts[number] = {
      started: Date.now() - start,
      retry: headers.get('x-retry-count'),
    };
    attempts.push(attempt);
    const signal = init?.signal;
    return new Promise<Response>((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer);
        attempt.ended = Date.now() - start;
        reject(signal?.reason);
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        attempt.ended = Date.now() - start;
        resolve(Response.json(reply.status ? { message: 'Transient fixture failure' } : [game], { status: reply.status ?? 200 }));
      }, reply.after);
      if (signal?.aborted) onAbort();
      else signal?.addEventListener('abort', onAbort, { once: true });
    });
  });
  return attempts;
}

async function request(slug = 'hades', cookie?: string) {
  const store: { route: string; incrementalCache: typeof incrementalCache; pendingRevalidates?: Record<string, Promise<unknown>> } = {
    route: '/api/games/[slug]',
    incrementalCache,
  };
  const req = new NextRequest(`http://localhost/api/games/${slug}`, { headers: cookie ? { cookie } : {} });
  const response: Response = await workAsyncStorage.run(store, () => getDetail(req, { params: Promise.resolve({ slug }) }));
  return { response, revalidations: Promise.all(Object.values(store.pendingRevalidates ?? {})) };
}

describe('game-detail slug deadline with the installed SDK and Next cache', () => {
  beforeAll(async () => {
    ({ NextRequest } = await import('next/server'));
    ({ GET: getDetail } = await import('@/app/api/games/[slug]/route'));
  });

  beforeEach(() => {
    entries.clear();
    vi.useFakeTimers({ now: start });
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', fixtureOrigin);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'isolated-public-fixture');
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError')), ms);
      return controller.signal;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns the same public game result for anonymous and cookie-bearing requests', async () => {
    const attempts = useTransport({ after: 4900 });
    const pending = request();
    await vi.advanceTimersByTimeAsync(4900);
    const { response, revalidations } = await pending;
    await revalidations;
    const hit = await request('hades', 'fixture-session=ignored');
    expect(response.status).toBe(200);
    expect(hit.response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('s-maxage=900, stale-while-revalidate=300');
    expect(hit.response.headers.get('cache-control')).toBe(response.headers.get('cache-control'));
    expect(hit.response.headers.get('x-verdict-resolved-via')).toBe('slug');
    const body = await response.json();
    expect(body).toMatchObject({ success: true, data: { slug: 'hades', title: 'Hades', coverImage: game.cover_image } });
    expect(await hit.response.json()).toEqual(body);
    expect(attempts).toEqual([{ started: 0, ended: 4900, retry: null }]);
  });

  it('can recover from an early retryable response within five seconds', async () => {
    const attempts = useTransport({ after: 200, status: 503 }, { after: 200 });
    const pending = request();
    await vi.advanceTimersByTimeAsync(1400);
    expect((await pending).response.status).toBe(200);
    expect(attempts).toEqual([
      { started: 0, ended: 200, retry: null },
      { started: 1200, ended: 1400, retry: '1' },
    ]);
  });

  it('aborts one cold attempt after five seconds, leaves the cache empty, and permits a later success', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const attempts = useTransport({ after: 60_000 }, { after: 10 });
    const pending = request();
    await vi.advanceTimersByTimeAsync(5000);
    const failed = await pending;
    await failed.revalidations;
    expect(failed.response.status).toBe(503);
    expect(failed.response.headers.get('cache-control')).toBeNull();
    expect(entries.size).toBe(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(attempts).toEqual([{ started: 0, ended: 5000, retry: null }]);

    const next = request();
    await vi.advanceTimersByTimeAsync(10);
    const recovered = await next;
    expect(recovered.response.status).toBe(200);
    await recovered.revalidations;
    expect(entries.size).toBe(1);
  });

  it('keeps the existing result on failed Next.js background revalidation', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const attempts = useTransport({ after: 10 }, { after: 60_000 });
    const pending = request();
    await vi.advanceTimersByTimeAsync(10);
    const initial = await pending;
    await initial.revalidations;
    expect(initial.response.status).toBe(200);
    const saved = [...entries.values()][0];
    expect(saved).toBeDefined();
    saved.isStale = true;

    const stale = await request();
    expect(stale.response.status).toBe(200);
    expect(await stale.response.json()).toEqual(await initial.response.json());
    await vi.advanceTimersByTimeAsync(5000);
    await stale.revalidations;
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('revalidating cache'), expect.objectContaining({
      message: expect.stringContaining('TimeoutError'),
    }));
    expect([...entries.values()]).toEqual([saved]);
    expect([...entries.values()][0]).toBe(saved);
    expect(attempts).toEqual([
      { started: 0, ended: 10, retry: null },
      { started: 10, ended: 5010, retry: null },
    ]);
  });

  it('keeps actual not-found responses private', async () => {
    const attempts = useTransport();
    const { response } = await request('invalid!');
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toContain('private, no-store');
    expect(response.headers.get('vary')).toBe('Cookie');
    expect(attempts).toEqual([]);
    expect(entries.size).toBe(0);
  });
});
