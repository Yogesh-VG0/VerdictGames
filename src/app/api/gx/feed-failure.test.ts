import { describe, expect, it, vi } from 'vitest';

const feeds = vi.hoisted(() => ({ deals: vi.fn(), free: vi.fn(), top: vi.fn() }));
vi.mock('@/lib/services/gx-feeds', () => ({
  GX_FEEDS_REVALIDATE_SECONDS: 300,
  GX_FEEDS_API_CACHE_CONTROL: 's-maxage=300',
  loadGXDeals: feeds.deals,
  loadGXFreeToPlay: feeds.free,
  loadGXTopGames: feeds.top,
}));

import { GET as deals } from './deals/route';
import { GET as free } from './free-to-play/route';
import { GET as top } from './top-games/route';

describe('public feed outcomes', () => {
  it.each([[deals, feeds.deals], [free, feeds.free], [top, feeds.top]])(
    'serves provider data and keeps a temporary failure out of shared caches', async (route, load) => {
      load.mockResolvedValueOnce([{ id: 'saved-listing' }]).mockRejectedValueOnce(new Error('upstream unavailable'));
      const healthy = await route();
      expect(healthy.status).toBe(200);
      expect((await healthy.json()).data).toEqual([{ id: 'saved-listing' }]);
      const unavailable = await route();
      expect(unavailable.status).toBe(503);
      expect(unavailable.headers.get('cache-control')).toContain('no-store');
      expect(await unavailable.json()).toMatchObject({ success: false });
    }
  );
});
