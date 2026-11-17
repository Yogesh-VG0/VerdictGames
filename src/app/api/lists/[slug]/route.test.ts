import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({user:vi.fn(),publicList:vi.fn(),owned:vi.fn(),db:{}}));
vi.mock('@/lib/supabase/auth',()=>({getCurrentUser:state.user,getAuthSupabase:async()=>state.db}));
vi.mock('@/lib/services/public-list',()=>({loadPublicList:state.publicList,readOwnedList:state.owned}));
import {GET} from './route';
const owner='00000000-0000-4000-8000-000000000001';
const request=(query='')=>GET(new NextRequest('https://example.test/api/lists/collection'+query),{params:Promise.resolve({slug:'collection'})});
const privateHeaders=(response:Response)=>{
  for(const name of ['Cache-Control','CDN-Cache-Control','Vercel-CDN-Cache-Control'])expect(response.headers.get(name)).toContain('no-store');
  expect(response.headers.get('Vary')).toContain('Cookie');
};
describe('public and owned collection detail boundaries',()=>{
  beforeEach(()=>{vi.resetAllMocks();state.user.mockResolvedValue({profileId:owner});});
  it('retains public caching and avoids identity reads for public detail',async()=>{
    state.publicList.mockResolvedValue({id:'public',isPublic:true});
    const response=await request();expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toContain('s-maxage=300');
    expect(state.user).not.toHaveBeenCalled();expect(state.owned).not.toHaveBeenCalled();
  });
  it('uses the authenticated profile owner and private headers for owned detail',async()=>{
    state.owned.mockResolvedValue({id:'owned',isPublic:false});
    const response=await request('?scope=mine&owner=spoofed');expect(response.status).toBe(200);privateHeaders(response);
    expect(state.owned).toHaveBeenCalledWith(state.db,'collection',owner);expect(state.publicList).not.toHaveBeenCalled();
  });
  it('does not return an owner-only detail to an anonymous caller',async()=>{
    state.user.mockResolvedValue(null);const response=await request('?scope=mine');expect(response.status).toBe(401);privateHeaders(response);expect(state.owned).not.toHaveBeenCalled();
  });
  it('keeps a different owner or unknown detail as a private 404',async()=>{
    state.user.mockResolvedValue({profileId:'00000000-0000-4000-8000-000000000002'});state.owned.mockResolvedValue(null);
    const response=await request('?scope=mine');expect(response.status).toBe(404);privateHeaders(response);
    expect(state.owned).toHaveBeenCalledWith(state.db,'collection','00000000-0000-4000-8000-000000000002');
  });
  it('returns private 503 on a failed read without logging private details',async()=>{
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});try{
      state.owned.mockRejectedValue({code:'57014',message:'DO_NOT_LOG_PRIVATE_COLLECTION'});
      const response=await request('?scope=mine');expect(response.status).toBe(503);privateHeaders(response);expect(JSON.stringify(log.mock.calls)).not.toContain('DO_NOT_LOG_PRIVATE_COLLECTION');
    }finally{log.mockRestore();}
  });
});
