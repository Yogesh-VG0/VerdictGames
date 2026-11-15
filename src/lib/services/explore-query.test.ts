import { beforeEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({rpc:vi.fn(),cachedReads:0}));
vi.mock('next/cache',()=>({unstable_cache:(fn:(...args:unknown[])=>unknown)=>(...args:unknown[])=>{state.cachedReads++;return fn(...args);}}));
vi.mock('@/lib/supabase/public',()=>({getPublicSupabase:()=>({rpc:state.rpc})}));
const valid={count:250,fetchedAt:'2026-11-15T12:00:00Z',rows:[{slug:'public-game',title:'Public Game',ranking_score:94,rank:1}]};
function response(data:unknown,error:unknown=null) {state.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data,error})});}
describe('bounded public SQL catalogue reads',()=>{
  beforeEach(()=>{vi.resetModules();state.rpc.mockReset();state.cachedReads=0;});
  it('normalizes unused arguments and caches only common small pages',async()=>{
    response(valid);const {readCataloguePage}=await import('./explore-query');
    await readCataloguePage('all-time',2025,'Action','','default',1,20,'2026-11-15');
    expect(state.rpc).toHaveBeenCalledWith('explore_catalogue_page',expect.objectContaining({p_year:0,p_genre:'',p_page:1,p_page_size:20}));
    expect(state.cachedReads).toBe(1);
    await readCataloguePage('all-time',2024,'RPG','PC','default',7,40,'2026-11-15');
    expect(state.cachedReads).toBe(1);
    await readCataloguePage('popular-in-year',1998,'','','default',1,20,'2026-11-15');
    expect(state.cachedReads).toBe(1);
    await readCataloguePage('popular-in-year',2025,'','','default',1,20,'2026-11-15');
    expect(state.cachedReads).toBe(2);
  });
  it('propagates database failures without treating them as a missing function',async()=>{
    response(null,{code:'57014'});const {readCataloguePage}=await import('./explore-query');
    await expect(readCataloguePage('all-time',0,'','','default',1,20,'2026-11-15')).rejects.toMatchObject({code:'57014'});
  });
  it('bounds the missing-schema compatibility probe and then recovers',async()=>{
    const now=vi.spyOn(Date,'now').mockReturnValue(100000);response(null,{code:'PGRST202'});
    const {readCataloguePage}=await import('./explore-query');
    expect(await readCataloguePage('all-time',0,'','','default',1,20,'2026-11-15')).toBeNull();
    expect(await readCataloguePage('genre',0,'Action','','default',1,20,'2026-11-15')).toBeNull();
    expect(state.rpc).toHaveBeenCalledTimes(1);
    now.mockReturnValue(160001);response(valid);
    expect(await readCataloguePage('all-time',0,'','','default',1,20,'2026-11-15')).toEqual(valid);
    now.mockRestore();
  });
  it.each([{...valid,count:-1},{...valid,fetchedAt:'unknown'},{...valid,rows:[{...valid.rows[0],rank:251}]},{...valid,rows:[{...valid.rows[0],ranking_score:null}]}])('does not admit malformed successful responses',async data=>{
    response(data);const {readCataloguePage}=await import('./explore-query');
    await expect(readCataloguePage('all-time',0,'','','default',1,20,'2026-11-15')).rejects.toThrow('Invalid catalogue query response');
  });
});
