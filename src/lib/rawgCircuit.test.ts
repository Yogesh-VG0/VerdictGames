import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('RAWG outage recovery', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T00:00:00Z'));
    vi.stubEnv('RAWG_API_KEY', 'local-test-only');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function openCircuit() {
    const fetch = vi.fn().mockResolvedValue(new Response('Unavailable', { status: 522 }));
    vi.stubGlobal('fetch', fetch);
    const { rawgFetchJson } = await import('../../scripts/lib/rawg-client.mjs');
    for (let i = 0; i < 4; i++) await expect(rawgFetchJson('/games', { attempts: 1 })).rejects.toThrow('522');
    return { fetch, rawgFetchJson };
  }

  it('blocks requests during cooldown and resumes after one successful probe', async () => {
    const { fetch, rawgFetchJson } = await openCircuit();
    await expect(rawgFetchJson('/games', { attempts: 1 })).rejects.toThrow('circuit is open');
    expect(fetch).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(60_000);
    fetch.mockImplementation(async () => Response.json({ results: ['recovered'] }));
    await expect(rawgFetchJson('/games')).resolves.toEqual({ results: ['recovered'] });
    await expect(rawgFetchJson('/games')).resolves.toEqual({ results: ['recovered'] });
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it('allows only one concurrent recovery probe', async () => {
    const { fetch, rawgFetchJson } = await openCircuit();
    vi.advanceTimersByTime(60_000);
    let finish!: (value: Response) => void;
    fetch.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    const probe = rawgFetchJson('/games');
    await Promise.resolve();
    await expect(rawgFetchJson('/games')).rejects.toThrow('circuit is open');
    expect(fetch).toHaveBeenCalledTimes(5);
    finish(Response.json({ ok: true }));
    await expect(probe).resolves.toEqual({ ok: true });
  });

  it('reopens for a full cooldown when the probe fails, without retrying the probe', async () => {
    const { fetch, rawgFetchJson } = await openCircuit();
    vi.advanceTimersByTime(60_000);
    await expect(rawgFetchJson('/games')).rejects.toThrow('522');
    expect(fetch).toHaveBeenCalledTimes(5);
    await expect(rawgFetchJson('/games')).rejects.toThrow('circuit is open');
    expect(fetch).toHaveBeenCalledTimes(5);
  });
});
