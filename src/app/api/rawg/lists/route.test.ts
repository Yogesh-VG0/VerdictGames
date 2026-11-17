import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const load=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/services/explore',()=>({loadExplore:load,EXPLORE_TYPES:new Set(['best-of-year']),EXPLORE_GENRES:{action:'Action'},EXPLORE_SORTS:new Set(['default']),EXPLORE_PLATFORMS:new Set(['PC'])}));
import {GET} from './route';
describe('public discovery recovery cache lifetime',()=>{
 beforeEach(()=>load.mockReset());
 it.each([true,false])('keeps degraded=%s public with the appropriate recovery lifetime',async degraded=>{
  load.mockResolvedValue({items:[],count:0,degraded});
  const response=await GET(new NextRequest('https://example.test/api/rawg/lists?type=best-of-year'));
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toContain(degraded?'s-maxage=60,':'s-maxage=3600,');
  expect(response.headers.get('Cache-Control')).toContain('public');
  expect(response.headers.get('Vary') || '').not.toContain('Cookie');
  expect(response.headers.get('CDN-Cache-Control')).toBeNull();
  expect(response.headers.get('Vercel-CDN-Cache-Control')).toBeNull();
 });
});
