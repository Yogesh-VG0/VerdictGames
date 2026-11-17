import { beforeEach, describe, expect, it, vi } from 'vitest';
const load = vi.hoisted(() => vi.fn());
vi.mock('@/lib/services/homepage', () => ({
  loadHomepageDataWithStatus: load,
  HOMEPAGE_API_CACHE_CONTROL: 's-maxage=300, stale-while-revalidate=300',
}));
import { GET } from './route';

describe('homepage failure cache boundary', () => {
  beforeEach(() => load.mockReset());
  it('keeps successful public collections cacheable', async () => {
    load.mockResolvedValue({ data: { hero: ['game'] }, degraded: false });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=300');
  });
  it('serves available cold-cache sections without caching failed sections', async () => {
    load.mockResolvedValue({ data: { hero: ['game'], topRated: [] }, degraded: true });
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).data.hero).toEqual(['game']);
    for (const name of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) {
      expect(response.headers.get(name)).toContain('no-store');
    }
  });
  it('returns an uncached recoverable service error for a complete cold outage', async () => {
    load.mockResolvedValue({ data: { hero: [], topRated: [] }, degraded: true });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get('Vercel-CDN-Cache-Control')).toContain('no-store');
    expect((await response.json()).success).toBe(false);
  });
});
