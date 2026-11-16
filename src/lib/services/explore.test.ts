import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], upcoming: vi.fn(), portraits: vi.fn().mockResolvedValue([]) }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/external/rawg', () => ({ getRawgUpcoming: state.upcoming }));
vi.mock('@/lib/external/igdb', () => ({ getIgdbPortraits: state.portraits }));
vi.mock('@/lib/services/explore-query', () => ({ readCataloguePage: async () => null }));
vi.mock('@/lib/supabase/public', () => ({ getPublicSupabase: () => {
  const query: Record<string, unknown> = {};
  for (const name of ['select','in','not','neq','gt','gte','lte','contains','order','limit','abortSignal','range','or']) query[name] = () => query;
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: state.rows, error: null }).then(resolve);
  return { from: () => query };
} }));
import { loadExplore, sortExploreItems } from './explore';
import type { RawgListGameItem } from '@/lib/api';

describe('Explore catalogue regressions', () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => { state.rows = []; state.upcoming.mockReset(); });
  it('keeps the provider upcoming pool even when only one entry is tracked locally, and resolves its cover and canonical slug', async () => {
    state.rows = [{ rawg_id: 1, slug: 'canonical-one', cover_image: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co123.jpg' }];
    state.upcoming.mockResolvedValue({ results: [1,2,3].map(id => ({ id, slug: `game-${id}`, name: `Game ${id}`, released: '2099-01-01', tba: false, rating:0, ratings_count:0, background_image: `scene-${id}.jpg`, tags: id === 3 ? [{name:'NSFW'}] : [], genres: [], platforms: [], added: 100, added_by_status: {} })) });
    const first = await loadExplore('best-of-year', 1, 1);
    expect(first.count).toBe(2);
    expect(first.hasNext).toBe(true);
    expect(first.items[0]).toMatchObject({ slug: 'canonical-one', image: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co123.jpg' });
    expect((await loadExplore('best-of-year', 2, 1)).items[0].slug).toBe('game-2');
  });
  it('uses an exactly matched IGDB cover for a real untracked anticipated title', async () => {
    state.portraits.mockResolvedValueOnce([{ name: 'Exodus', year:2099, companies:['Archetype Entertainment'], aliases: [], image: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co123.jpg' }]);
    state.upcoming.mockResolvedValue({ results: [{ id: 973389, slug: 'exodus-archetype-entertainment', name: 'Exodus (Archetype Entertainment)', released: '2099-04-07', tba:false, rating:0, ratings_count:0, background_image: 'https://media.rawg.io/media/screenshots/c78/example.jpg', tags: [], genres: [], platforms: [], added: 23, added_by_status: { toplay: 12 } }] });
    const result = await loadExplore('best-of-year');
    expect(result.items[0].imageKind).toBe('cover');
    expect(result.items[0].metricSource).toBe('rawg');
    expect(result.items[0].added).toBe(23);
  });
  it('uses stored records on a provider failure without inventing RAWG counters', async () => {
    state.upcoming.mockRejectedValue(new Error('429'));
    state.rows = [{ id: '1', slug: 'upcoming', title: 'Upcoming', release_date: '2099-01-01', cover_image: 'poster.jpg', review_count: 999, tags: [], genres: [] }];
    const result = await loadExplore('best-of-year');
    expect(result.degraded).toBe(true);
    expect(result.items[0]).toMatchObject({ added: 0, toplay: 0, metricSource: 'catalogue' });
  });
  it('sorts the complete result set before slicing and keeps the Top 250 ranks stable under filters', async () => {
    state.rows = Array.from({ length: 40 }, (_, i) => ({ id: String(i), slug: `game-${i}`, title: `Game ${String(39-i).padStart(2,'0')}`, score: 60+i, review_count:10000, release_date:'2025-01-01', platforms: i%2 ? ['PC'] : ['PlayStation 5'], tags:[], genres:[] }));
    const first = await loadExplore('popular-in-year', 1, 5, 2025, 'action', 'name-asc');
    expect(first.items.map(i => i.name)).toEqual(['Game 00','Game 01','Game 02','Game 03','Game 04']);
    const ranked = await loadExplore('all-time', 1, 5, 2025, 'action', 'default', 'PC');
    expect(ranked.items.map(i => i.rank)).toEqual([1,3,5,7,9]);
  });
  it('uses deterministic slug tie breaks', () => {
    const items = [{ name:'Same', slug:'b' }, { name:'Same', slug:'a' }] as RawgListGameItem[];
    expect(sortExploreItems(items, 'name-asc', 'genre').map(i => i.slug)).toEqual(['a','b']);
  });
  it('records failed provider work and the accurate catalogue fallback separately', async () => {
    state.upcoming.mockRejectedValue(new Error('provider unavailable'));
    const timings: [string,number][] = [];
    const result = await loadExplore('best-of-year',1,20,2025,'action','default','',(phase,ms)=>timings.push([phase,ms]));
    expect(result).toMatchObject({source:'catalogue',degraded:true,items:[]});
    expect(timings.map(([phase])=>phase)).toEqual(['snapshot','catalogue_query','legacy_pool']);
    expect(timings.every(([,ms])=>Number.isFinite(ms)&&ms>=0)).toBe(true);
  });
  it('uses title cover art instead of a gameplay header for year and genre grids', async () => {
    state.rows = [{ slug:'game', title:'Game', cover_image:'poster.jpg', header_image:'gameplay.jpg', score:90, tags:[], genres:[] }];
    expect((await loadExplore('popular-in-year')).items[0].image).toBe('poster.jpg');
  });
  it('replaces an imported screenshot cover only when the official Steam poster is available', async () => {
    const fetchPoster = vi.fn().mockResolvedValue(new Response(null, { status:200, headers:{'content-type':'image/jpeg'} }));
    vi.stubGlobal('fetch', fetchPoster);
    state.rows = [{ slug:'game', title:'Game', steam_app_id:2912430, cover_image:'https://media.rawg.io/media/screenshots/game.jpg', header_image:'scene.jpg', score:90, tags:[], genres:[] }];
    expect((await loadExplore('popular-in-year')).items[0].image).toContain('/2912430/library_600x900_2x.jpg');
    expect(fetchPoster.mock.calls[0][1].method).toBe('HEAD');
    fetchPoster.mockResolvedValue(new Response(null, {status:404}));
    expect((await loadExplore('popular-in-year')).items[0].image).toContain('/screenshots/game.jpg');
  });
});
