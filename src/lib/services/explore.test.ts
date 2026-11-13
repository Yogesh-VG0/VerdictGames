import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], upcoming: vi.fn() }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/external/rawg', () => ({ getRawgUpcoming: state.upcoming }));
vi.mock('@/lib/supabase/public', () => ({ getPublicSupabase: () => {
  const query: Record<string, unknown> = {};
  for (const name of ['select','in','not','neq','gt','gte','lte','contains','order','limit','abortSignal']) query[name] = () => query;
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: state.rows, error: null }).then(resolve);
  return { from: () => query };
} }));
import { loadExplore } from './explore';

describe('Explore catalogue regressions', () => {
  beforeEach(() => { state.rows = []; state.upcoming.mockReset(); });
  it('keeps the provider upcoming pool even when only one entry is tracked locally, and resolves its cover and canonical slug', async () => {
    state.rows = [{ rawg_id: 1, slug: 'canonical-one', cover_image: 'cover-one.jpg' }];
    state.upcoming.mockResolvedValue({ results: [1,2,3].map(id => ({ id, slug: `game-${id}`, name: `Game ${id}`, released: '2099-01-01', tba: false, background_image: `scene-${id}.jpg`, tags: id === 3 ? [{name:'NSFW'}] : [], genres: [], platforms: [], added: 100, added_by_status: {} })) });
    const first = await loadExplore('best-of-year', 1, 1);
    expect(first.count).toBe(2);
    expect(first.hasNext).toBe(true);
    expect(first.items[0]).toMatchObject({ slug: 'canonical-one', image: 'cover-one.jpg' });
    expect((await loadExplore('best-of-year', 2, 1)).items[0].slug).toBe('game-2');
  });
  it('uses title cover art instead of a gameplay header for year and genre grids', async () => {
    state.rows = [{ slug:'game', title:'Game', cover_image:'poster.jpg', header_image:'gameplay.jpg', score:90, tags:[], genres:[] }];
    expect((await loadExplore('popular-in-year')).items[0].image).toBe('poster.jpg');
  });
});
