import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({load:vi.fn(),configured:vi.fn()}));
vi.mock('@/lib/services/search',()=>({loadSearchResults:mocks.load,SEARCH_API_CACHE_CONTROL:'s-maxage=300, stale-while-revalidate=300',SEARCH_REVALIDATE_SECONDS:300}));
vi.mock('@/lib/supabase/public',()=>({hasPublicSupabaseEnv:mocks.configured}));
import {GET} from './route';
describe('public search cache boundary',()=>{
  beforeEach(()=>{mocks.load.mockReset();mocks.configured.mockReturnValue(true);});
  it('does not cache database or transport failures at any CDN layer',async()=>{
    mocks.load.mockRejectedValue(new Error('test database timeout'));
    const log=vi.spyOn(console,'warn').mockImplementation(()=>{});
    try {
      const response=await GET(new NextRequest('http://localhost/api/search?sort=recently-added'));
      expect(response.status).toBe(503);
      for(const header of ['cache-control','cdn-cache-control','vercel-cdn-cache-control']){
        expect(response.headers.get(header)).toContain('private, no-store');
      }
      expect(response.headers.get('vary')).toContain('Cookie');
    } finally {log.mockRestore();}
  });
  it('retains public caching for successful catalogue responses',async()=>{
    mocks.load.mockResolvedValue({items:[],total:0});
    const response=await GET(new NextRequest('http://localhost/api/search'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('s-maxage=300, stale-while-revalidate=300');
  });
  it('reports missing configuration without attempting a read',async()=>{
    mocks.configured.mockReturnValue(false);
    const response=await GET(new NextRequest('http://localhost/api/search?q=Hades'));
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('30');
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it('keeps time-sensitive Trending results out of the response CDN',async()=>{
    mocks.load.mockResolvedValue({items:[],total:0});
    const response=await GET(new NextRequest('http://localhost/api/search?sort=trending'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
