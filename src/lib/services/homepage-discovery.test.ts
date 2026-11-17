import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({load:vi.fn(),cached:undefined as {value:unknown}|undefined}));
vi.mock('next/cache',()=>({unstable_cache:(read:()=>Promise<unknown>,keys:string[])=>keys.includes('homepage-most-anticipated-v6')?async()=>{
 if(state.cached)return state.cached.value;
 const value=await read();state.cached={value};return value;
}:read}));
vi.mock('@/lib/services/explore',()=>({loadExplore:state.load}));
const item={rawgId:1,slug:'discovered-game',name:'Discovered Game',released:null,tba:true,earlyAccess:false,image:null,added:0,toplay:0,genres:[]};
describe('homepage discovery cache admission',()=>{
 beforeEach(()=>{vi.resetModules();state.load.mockReset();state.cached=undefined;vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.supabase.co')});
 afterEach(()=>vi.unstubAllEnvs());
 it('shows a degraded fallback without retaining it, then admits the recovered snapshot',async()=>{
  state.load.mockResolvedValueOnce({items:[item],degraded:true}).mockResolvedValueOnce({items:[{...item,name:'Recovered Snapshot'}],degraded:false});
  const {loadHomepageMostAnticipatedWithStatus:read}=await import('./homepage');
  const fallback=await read();expect(fallback.degraded).toBe(true);expect(fallback.data[0].name).toBe('Discovered Game');expect(state.cached).toBeUndefined();
  const recovered=await read();expect(recovered.degraded).toBe(false);expect(recovered.data[0].name).toBe('Recovered Snapshot');
  expect(await read()).toEqual(recovered);expect(state.load).toHaveBeenCalledTimes(2);
 });
 it('recovers from a hard read error and still caches genuinely empty successful discovery',async()=>{
  state.load.mockRejectedValueOnce(new Error('Controlled database failure')).mockResolvedValueOnce({items:[],degraded:false});
  const {loadHomepageMostAnticipatedWithStatus:read}=await import('./homepage');
  expect(await read()).toEqual({data:[],degraded:true});expect(state.cached).toBeUndefined();
  expect(await read()).toEqual({data:[],degraded:false});expect(await read()).toEqual({data:[],degraded:false});expect(state.load).toHaveBeenCalledTimes(2);
 });
});
