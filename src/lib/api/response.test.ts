import { describe, expect, it } from 'vitest';
import { jsonError, jsonOk, jsonPrivateOk } from './response';

describe('response cache isolation', () => {
  it.each([
    ['personalized success', () => jsonPrivateOk({ userVote: 1 })],
    ['empty personalized result', () => jsonPrivateOk([])],
    ['authentication error', () => jsonError('Not authenticated', 401)],
    ['upstream failure', () => jsonError('Unavailable', 503)],
  ])('prevents browser and higher-priority CDN storage for %s', (_, respond) => {
    const response = respond();
    for (const header of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) {
      expect(response.headers.get(header)).toContain('no-store');
      expect(response.headers.get(header)).not.toMatch(/s-maxage|stale-while-revalidate/);
    }
    expect(response.headers.get('Cache-Control')).toContain('private');
    expect(response.headers.get('Vary')).toBe('Cookie');
  });

  it('preserves explicitly public catalogue caching', () => {
    const response = jsonOk([{ slug: 'hades' }], 200, { cache: true });
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=60');
    expect(response.headers.has('Vercel-CDN-Cache-Control')).toBe(false);
  });

  it('preserves custom public cache lifetimes', () => {
    const policy = 's-maxage=900, stale-while-revalidate=3600';
    expect(jsonOk([], 200, { cacheControl: policy }).headers.get('Cache-Control')).toBe(policy);
  });
});
