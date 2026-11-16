import {afterEach,describe,expect,it,vi} from 'vitest';
import {getLibrary,getLibraryStats} from './api';
describe('library client preserves unavailable versus empty',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it.each([getLibrary,getLibraryStats])('propagates an unavailable private read to query error state',async read=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({success:false,error:'Unavailable'}),{status:503})));
    await expect(read()).rejects.toThrow('Failed to fetch /api/library');
  });
  it('returns a genuine empty library successfully',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true,data:[]}))));
    expect(await getLibrary()).toEqual([]);
  });
});
