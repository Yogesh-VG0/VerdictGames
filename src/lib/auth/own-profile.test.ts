import { describe, expect, it, vi } from 'vitest';
import { loadOwnProfile } from './own-profile';

const profile = { id: 'identity-a', username: 'player-a', role: 'user' };
const ok = (data = profile) => Response.json({ success: true, data });

describe('private profile recovery', () => {
  it('recovers one temporary failure without losing the verified identity', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(ok());
    expect(await loadOwnProfile(profile.id, () => true, request)).toEqual(profile);
    expect(request).toHaveBeenCalledTimes(2);
    for (const [, options] of request.mock.calls) expect(options?.cache).toBe('no-store');
  });
  it('never retries indefinitely when the service stays down', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status: 503 }));
    expect(await loadOwnProfile(profile.id, () => true, request)).toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it.each([401, 403, 429])('does not retry an access/rate-limit response %i', async status => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));
    expect(await loadOwnProfile(profile.id, () => true, request)).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('cannot accept a previous or different identity from a successful response', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(ok({ ...profile, id: 'identity-b' }));
    expect(await loadOwnProfile(profile.id, () => true, request)).toBeNull();
  });
  it('stops before retrying or bootstrapping when the identity changes', async () => {
    let current = true;
    const request = vi.fn<typeof fetch>().mockImplementation(async () => { current = false; return new Response(null, { status: 401 }); });
    expect(await loadOwnProfile(profile.id, () => current, request)).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('keeps bootstrap on the session-verified server endpoint', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ success: true })).mockResolvedValueOnce(ok());
    expect(await loadOwnProfile(profile.id, () => true, request)).toEqual(profile);
    expect(request.mock.calls[1]).toEqual(['/api/auth/bootstrap', expect.objectContaining({ method: 'POST', cache: 'no-store' })]);
  });
  it('aborts a stalled attempt without retrying past the shared deadline', async () => {
    vi.useFakeTimers();
    try {
      const request = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true });
      }));
      const result = loadOwnProfile(profile.id, () => true, request);
      await vi.advanceTimersByTimeAsync(8250);
      expect(await result).toBeNull();
      expect(request).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
});
