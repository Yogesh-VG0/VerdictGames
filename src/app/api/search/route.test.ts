import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({load:vi.fn()}));
vi.mock('@/lib/services/search',()=>({loadSearchResults:mocks.load,SEARCH_API_CACHE_CONTROL:'s-maxage=300, stale-while-revalidate=300',SEARCH_REVALIDATE_SECONDS:300}));
import {GET} from './route';
describe('public search cache boundary',()=>{
  beforeEach(()=>{mocks.load.mockReset();});
  it('does not cache database or transport failures at any CDN layer',async()=>{
    mocks.load.mockRejectedValue(new Error('test database timeout'));
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});
    try {
      const response=await GET(new NextRequest('http://localhost/api/search?sort=recently-added'));
      expect(response.status).toBe(500);
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
});
