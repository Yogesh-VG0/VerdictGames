import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/utils/providerUsage', () => ({ recordProviderUsage: vi.fn() }));
describe('public RAWG read resilience', () => {
  beforeEach(() => { vi.resetModules(); vi.stubEnv('RAWG_API_KEY', 'synthetic-test'); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
  it('deduplicates concurrent identical searches without sharing a consumed response body', async () => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json({ results: [] }));
    vi.stubGlobal('fetch', fetcher);
    const { searchRawg } = await import('./rawg');
    const results = await Promise.all([searchRawg('Hades'), searchRawg('Hades')]);
    expect(results).toEqual([{ results: [] }, { results: [] }]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('honors a shorter caller deadline while retaining the provider failure circuit', async () => {
    const controller=new AbortController();
    const fetcher=vi.fn((_url,init)=>new Promise<Response>((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true})));
    vi.stubGlobal('fetch',fetcher);
    const {getRawgUpcoming}=await import('./rawg');
    const request=getRawgUpcoming(controller.signal);
    const rejected=expect(request).rejects.toMatchObject({name:'AbortError'});
    controller.abort();await rejected;
    await expect(getRawgUpcoming()).rejects.toThrow('temporarily unavailable');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([429, 500, 503])('stops repeat calls after HTTP %s, then recovers', async status => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue(new Response('Unavailable', { status }));
    vi.stubGlobal('fetch', fetcher);
    const { getRawgUpcoming } = await import('./rawg');
    await expect(getRawgUpcoming()).rejects.toThrow();
    await expect(getRawgUpcoming()).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_001);
    fetcher.mockResolvedValue(Response.json({ count:1, results: [{ id: 1, name:'Game',slug:'game',released:null,tba:true,added:0,ratings_count:0,rating:0,tags:[],genres:[],platforms:[] }] }));
    expect((await getRawgUpcoming()).results).toHaveLength(1);
  });
  it('treats malformed JSON and network timeouts as failed reads', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{not json', { status:200 }));
    vi.stubGlobal('fetch', fetcher);
    const { getRawgUpcoming } = await import('./rawg');
    await expect(getRawgUpcoming()).rejects.toThrow();
    await expect(getRawgUpcoming()).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('remembers an unavailable endpoint without breaking unrelated metadata', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetcher);
    const { getRawgGame, searchRawg } = await import('./rawg');
    await expect(getRawgGame(999)).rejects.toThrow();
    await expect(getRawgGame(999)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValue(Response.json({ results: [] }));
    await searchRawg('Hades');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects malformed discovery objects and empty lists before cache admission', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ results:[{id:1,name:'Game',slug:'game',tags:'wrong'}] }));
    vi.stubGlobal('fetch',fetcher);
    const { getRawgUpcoming } = await import('./rawg');
    await expect(getRawgUpcoming()).rejects.toThrow('Invalid upcoming');
    await expect(getRawgUpcoming()).rejects.toThrow('temporarily unavailable');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].cache).toBe('no-store');
  });
});
