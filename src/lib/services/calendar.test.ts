import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ upcoming: vi.fn(), gx: vi.fn(), catalogue: vi.fn() }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/services/explore', () => ({ loadExplore: state.upcoming }));
vi.mock('@/lib/external/gx-cache', () => ({ gxFetchCalendarMonthSnapshot: state.gx }));
vi.mock('@/lib/supabase/public', () => ({
  hasPublicSupabaseEnv: () => true,
  getPublicSupabase: () => ({ from: state.catalogue }),
}));
import { loadCalendarMonth } from './calendar';

describe('calendar snapshot fallback', () => {
  const month = '2099-12';
  const item = (name: string, precision: string, value: string) => ({
    rawgId: name.length, name, slug: name.toLowerCase().replaceAll(' ', '-'),
    released: '2099-12-31', releaseTiming: { precision, value }, image: 'https://example.com/poster.jpg',
    genres: [], platforms: [],
  });
  beforeEach(() => {
    const query: Record<string, unknown> = {};
    for (const method of ['select', 'not', 'neq', 'gte', 'lte', 'order', 'limit']) query[method] = () => query;
    query.abortSignal = () => Promise.resolve({ data: [], error: null });
    state.catalogue.mockReturnValue(query);
    state.gx.mockResolvedValue({ items: [], source: 'snapshot', fetchedAt: new Date().toISOString() });
  });

  it('uses a fresh partial snapshot and only assigns confirmed days or months to December', async () => {
    state.upcoming.mockResolvedValue({ source: 'rawg', degraded: true, fetchedAt: new Date().toISOString(), items: [
      item('Confirmed Day', 'day', '2099-12-31'), item('Known Month', 'month', month),
      item('Quarter Window', 'quarter', '2099-Q4'), item('Year Window', 'year', '2099'),
    ] });
    const result = await loadCalendarMonth(month);
    expect(result.unavailable).toBe(true);
    expect(result.items.map(game => game.title)).toEqual(['Confirmed Day', 'Known Month']);
    expect(result.items[1].releaseTiming).toEqual({ precision: 'month', value: month });
  });

  it('keeps an expired snapshot out and reports missing coverage', async () => {
    state.upcoming.mockResolvedValue({ source: 'rawg', degraded: true,
      fetchedAt: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
      items: [item('Old Claim', 'day', '2099-12-31')],
    });
    const result = await loadCalendarMonth(month);
    expect(result).toMatchObject({ items: [], unavailable: true });
  });
});
