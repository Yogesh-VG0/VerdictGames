import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({result:{data:null as unknown,error:null as unknown}}));
vi.mock('@/lib/supabase/auth',()=>({
  getCurrentUser:async()=>({profileId:'00000000-0000-4000-8000-000000000001'}),
  getAuthSupabase:async()=>({from:()=>({select:()=>({eq:async()=>state.result})})}),
}));
import {GET} from './route';
describe('private library statistics failure handling',()=>{
  beforeEach(()=>{state.result={data:[],error:null};});
  it('does not report zero statistics after a database error',async()=>{
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});
    try{
      state.result={data:null,error:{code:'57014',message:'DO_NOT_LOG'}};
      const response=await GET();expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({success:false});
      expect(response.headers.get('Vercel-CDN-Cache-Control')).toContain('no-store');
      expect(JSON.stringify(log.mock.calls)).not.toContain('DO_NOT_LOG');
    }finally{log.mockRestore();}
  });
  it('preserves zero statistics for an actually empty library',async()=>{
    const response=await GET();expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({total:0,totalHours:0,averageRating:0});
  });
});
