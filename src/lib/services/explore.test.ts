import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], compact: null as Record<string,unknown>|null, upcoming: vi.fn(), dates: vi.fn(), portraits: vi.fn().mockResolvedValue([]) }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/external/rawg', () => ({ getRawgUpcoming: state.upcoming }));
vi.mock('@/lib/external/igdb', () => ({ getIgdbPortraits: state.portraits, getIgdbReleaseDates: state.dates }));
vi.mock('@/lib/services/explore-query', () => ({ readCataloguePage: async () => state.compact }));
vi.mock('@/lib/supabase/public', () => ({ getPublicSupabase: () => {
  const query: Record<string, unknown> = {};
  for (const name of ['select','in','not','neq','gt','gte','lte','contains','order','limit','abortSignal','range','or']) query[name] = () => query;
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: state.rows, error: null }).then(resolve);
  return { from: () => query };
} }));
import { loadExplore, sortExploreItems } from './explore';
import type { RawgListGameItem } from '@/lib/api';

describe('Explore catalogue regressions', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  beforeEach(() => { state.rows = []; state.compact = null; state.upcoming.mockReset(); state.dates.mockReset(); });
  it('shows the reviewed Catalyst year and omits its obsolete provider date from the calendar', async () => {
    vi.stubEnv('TWITCH_CLIENT_ID', 'fixture');
    vi.stubEnv('TWITCH_CLIENT_SECRET', 'fixture');
    const released = '2027-12-31';
    const name = 'Tomb Raider: Catalyst';
    state.upcoming.mockResolvedValue({ count: 1, results: [{
      id: 1015411, slug: 'tomb-raider-catalyst', name, released, tba: false, rating: 0, ratings_count: 0,
      background_image: 'poster.jpg', tags: [], genres: [], platforms: [], added: 100,
    }] });
    state.dates.mockResolvedValue([{ name, id: 10, release_dates: [{ y: 2027, date_format: { format: 'YYYY' } }] }]);
    expect((await loadExplore('best-of-year')).items[0]).toMatchObject({
      releaseWindow: '2028', releaseTiming: { precision: 'year', value: '2028' },
    });
    const calendar = await loadExplore('best-of-year', 1, 20, 2027, 'action', 'default', '', undefined,
      { snapshotOnly: true, releaseMonth: '2027-12' });
    expect(calendar.items).toEqual([]);
  });
  it('keeps an explicit December 31 launch and excludes a year-only entry from a December view', async () => {
    vi.stubEnv('TWITCH_CLIENT_ID', 'fixture');
    vi.stubEnv('TWITCH_CLIENT_SECRET', 'fixture');
    const released = '2099-12-31';
    const names = ['Year Window', 'Confirmed Day'];
    state.upcoming.mockResolvedValue({ count: 2, results: names.map((name, index) => ({
      id: index + 1, slug: index ? 'confirmed-day' : 'year-window', name, released, tba: false,
      rating: 0, ratings_count: 0, background_image: 'poster.jpg', tags: [], genres: [], platforms: [], added: 100,
    })) });
    state.dates.mockResolvedValue(names.map((name, index) => ({ name, id: index + 10, release_dates: [{
      date: Date.parse(released + 'T00:00:00Z') / 1000,
      date_format: { format: index ? 'YYYYMMMMDD' : 'YYYY' },
    }] })));
    const all = await loadExplore('best-of-year', 1, 20, 2099, 'action', 'default', '', undefined, { snapshotOnly: true });
    expect(all.items.find(game => game.slug === 'year-window')).toMatchObject({
      released, releaseWindow: '2099', releaseTiming: { precision: 'year', value: '2099' },
    });
    const december = await loadExplore('best-of-year', 1, 20, 2099, 'action', 'default', '', undefined,
      { snapshotOnly: true, releaseMonth: '2099-12' });
    expect(december.items).toHaveLength(1);
    expect(december.items[0]).toMatchObject({ slug: 'confirmed-day', released, releaseTiming: { precision: 'day', value: released } });
  });
  it('keeps the provider upcoming pool even when only one entry is tracked locally, and resolves its cover and canonical slug', async () => {
    state.rows = [{ rawg_id: 1, slug: 'canonical-one', cover_image: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co123.jpg' }];
    state.upcoming.mockResolvedValue({ count: 3, results: [1,2,3].map(id => ({ id, slug: `game-${id}`, name: `Game ${id}`, released: '2099-01-01', tba: false, rating:0, ratings_count:0, background_image: `scene-${id}.jpg`, tags: id === 3 ? [{name:'NSFW'}] : [], genres: [], platforms: [], added: 100, added_by_status: {} })) });
    const first = await loadExplore('best-of-year', 1, 1);
    expect(first.count).toBe(2);
    expect(first.hasNext).toBe(true);
    expect(first.items[0]).toMatchObject({ slug: 'canonical-one', image: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co123.jpg' });
    expect((await loadExplore('best-of-year', 2, 1)).items[0].slug).toBe('game-2');
  });
  it('keeps an untracked upcoming title on its own snapshot art without a render-time IGDB lookup', async () => {
    state.upcoming.mockResolvedValue({ count: 1, results: [{ id: 973389, slug: 'exodus-archetype-entertainment', name: 'Exodus (Archetype Entertainment)', released: '2099-04-07', tba:false, rating:0, ratings_count:0, background_image: 'https://media.rawg.io/media/screenshots/c78/example.jpg', tags: [], genres: [], platforms: [], added: 23, added_by_status: { toplay: 12 } }] });
    const result = await loadExplore('best-of-year');
    expect(result.items[0].image).toContain('/screenshots/c78/example.jpg');
    expect(state.portraits).not.toHaveBeenCalled();
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
  it('excludes a locally verified full release from provider TBA discovery without changing remaining interest counts',async()=>{
    state.rows=[{rawg_id:1,slug:'released',release_status:'released',tags:['Early Access'],cover_image:'https://images.igdb.com/igdb/image/upload/t_cover_big/co123.jpg'}];
    state.upcoming.mockResolvedValue({count:2,results:[1,2].map(id=>({id,slug:`game-${id}`,name:`Game ${id}`,released:null,tba:true,rating:0,ratings_count:0,background_image:'poster.jpg',tags:[],genres:[],platforms:[],added:123,added_by_status:{toplay:17}}))});
    const result=await loadExplore('best-of-year');
    expect(result.count).toBe(1);
    expect(result.items[0]).toMatchObject({slug:'game-2',added:123,toplay:17,metricSource:'rawg'});
  });
  it('keeps verified full releases out of the legacy upcoming fallback despite historical tags',async()=>{
    state.upcoming.mockRejectedValue(new Error('Provider unavailable'));
    state.rows=[{id:'1',slug:'released',title:'Released',release_date:'2020-09-17',release_status:'released',tags:['Early Access'],genres:[],cover_image:'poster.jpg'},
      {id:'2',slug:'awaiting',title:'Awaiting',release_date:'2099-01-01',release_status:null,tags:['Early Access'],genres:[],cover_image:'poster.jpg'}];
    const result=await loadExplore('best-of-year');
    expect(result.items.map(item=>item.slug)).toEqual(['awaiting']);
    expect(result.items[0]).toMatchObject({added:0,toplay:0,metricSource:'catalogue'});
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
  it.each(['compact', 'legacy'])('reuses stored artwork without Steam HEAD calls on the %s path', async mode => {
    const rows = Array.from({ length: 16 }, (_, index) => ({
      id: String(index), slug: 'game-' + String(index).padStart(2, '0'), title: 'Game ' + index,
      release_date: '2020-01-01', score: 90, verdict_score: 90, confidence: 1,
      review_count: 1000, tags: [], genres: [], platforms: ['PC'], steam_app_id: index + 100,
      cover_image: index === 10 ? 'https://media.rawg.io/media/screenshots/game.jpg'
        : 'https://images.igdb.com/igdb/image/upload/t_cover_big/co123.jpg',
      ranking_score: 90, rank: index + 1,
    }));
    state.rows = rows;
    if (mode === 'compact') state.compact = { count: 16, rows, fetchedAt: new Date().toISOString() };
    const externalFetch = vi.fn();
    vi.stubGlobal('fetch', externalFetch);
    const result = await loadExplore('all-time', 1, 16, 2025, 'action', 'rating');
    expect(externalFetch).not.toHaveBeenCalled();
    expect(result.items.find(item => item.slug === 'game-10')).toMatchObject({
      image: 'https://media.rawg.io/media/screenshots/game.jpg', imageKind: 'artwork',
    });
    expect(result.items.filter(item => item.imageKind === 'cover')).toHaveLength(15);
  });
});
