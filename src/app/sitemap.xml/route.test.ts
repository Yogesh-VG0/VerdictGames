import { beforeEach, describe, expect, it, vi } from 'vitest';

const { connection, loadSitemap } = vi.hoisted(() => ({ connection: vi.fn(), loadSitemap: vi.fn() }));
vi.mock('next/server', () => ({ connection }));
vi.mock('@/lib/services/sitemap', () => ({ loadSitemap }));
import { GET } from './route';

describe('runtime sitemap response', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('waits for a request before querying, then caches the complete XML', async () => {
    let requestArrived = false;
    connection.mockImplementation(async () => { requestArrived = true; });
    loadSitemap.mockImplementation(async () => {
      expect(requestArrived).toBe(true);
      return [{ url: 'https://www.verdict.games/game/hades' }];
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(response.headers.get('cache-control')).toContain('s-maxage=21600');
    expect(response.headers.get('cache-control')).toContain('stale-if-error=86400');
    expect(await response.text()).toContain('<loc>https://www.verdict.games/game/hades</loc>');
  });

  it('returns an uncached retryable failure on the reported database timeout', async () => {
    loadSitemap.mockRejectedValue({ code: '57014', message: 'canceling statement due to statement timeout' });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBe('60');
    expect(await response.text()).not.toContain('<urlset');
  });
});
