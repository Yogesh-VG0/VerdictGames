import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({user:vi.fn(),from:vi.fn(),order:vi.fn()}));
vi.mock('@/lib/supabase/auth',()=>({getCurrentUser:state.user}));
vi.mock('@/lib/supabase/server',()=>({getServerSupabase:()=>({from:state.from})}));
import {GET} from './route';

describe('private library read failure handling',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();state.user.mockResolvedValue({profileId:'00000000-0000-4000-8000-000000000001'});
    state.from.mockReturnValue({select:()=>({eq:()=>({order:state.order})})});
  });
  it('returns a private 503 for a database failure instead of a successful empty library',async()=>{
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});
    try{
      state.order.mockResolvedValue({data:null,error:{code:'57014',message:'DO_NOT_LOG_PRIVATE_DETAILS'}});
      const response=await GET(new NextRequest('https://example.test/api/library'));
      expect(response.status).toBe(503);expect(await response.json()).toMatchObject({success:false});
      for(const name of ['Cache-Control','CDN-Cache-Control','Vercel-CDN-Cache-Control']) expect(response.headers.get(name)).toContain('no-store');
      expect(response.headers.get('Vary')).toContain('Cookie');
      expect(JSON.stringify(log.mock.calls)).not.toContain('DO_NOT_LOG_PRIVATE_DETAILS');
    }finally{log.mockRestore();}
  });
  it('retains a successful genuinely empty library',async()=>{
    state.order.mockResolvedValue({data:[],error:null});
    const response=await GET(new NextRequest('https://example.test/api/library'));
    expect(response.status).toBe(200);expect(await response.json()).toEqual({success:true,data:[]});
    expect(response.headers.get('Cache-Control')).toContain('private');
  });
  it('rejects anonymous access before a catalogue or library query',async()=>{
    state.user.mockResolvedValue(null);
    const response=await GET(new NextRequest('https://example.test/api/library'));
    expect(response.status).toBe(401);expect(state.from).not.toHaveBeenCalled();
  });
});
