import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('../../../scripts/lib/rawg-client.mjs',()=>({rawgFetchJson:state.read}));
import {refreshDiscoverySnapshot,refreshCommunitySnapshots} from '../../../scripts/lib/discovery-snapshot.mjs';
const game=(id:number)=>({id,name:`Game ${id}`,slug:`game-${id}`,released:'2027-01-01',tba:false,rating:0,ratings_count:0,added:10,tags:[],genres:[],platforms:[],description:'discard me'});
function database() {
 const write=vi.fn().mockResolvedValue([]);
 return Object.assign(write,{json:(value:unknown)=>value});
}
describe('existing discovery worker public snapshot maintenance',()=>{
 beforeEach(()=>state.read.mockReset());
 it('writes one complete compact upcoming snapshot after reading the final provider page',async()=>{
  const sql=database();state.read.mockResolvedValueOnce({count:46,results:Array.from({length:40},(_,i)=>game(i+1))})
    .mockResolvedValueOnce({count:46,results:Array.from({length:6},(_,i)=>game(i+41))});
  expect(await refreshDiscoverySnapshot(sql)).toBe(46);expect(sql).toHaveBeenCalledTimes(1);
  expect(state.read).toHaveBeenCalledWith('/games',expect.objectContaining({params:expect.objectContaining({page:2,page_size:40})}));
  const payload=sql.mock.calls[0][1];expect(payload.complete).toBe(true);expect(payload.results).toHaveLength(46);expect(JSON.stringify(payload)).not.toContain('discard me');
 });
 it('does not overwrite a successful durable value with a failed later page',async()=>{
  const sql=database();state.read.mockResolvedValueOnce({count:46,results:Array.from({length:40},(_,i)=>game(i+1))}).mockRejectedValueOnce(new Error('provider unavailable'));
  await expect(refreshDiscoverySnapshot(sql)).rejects.toThrow();expect(sql).not.toHaveBeenCalled();
 });
 it('bounds ranking snapshots to one All-Time key and the current three release years',async()=>{
  const sql=database();state.read.mockResolvedValue({count:1,results:[game(1)]});
  const result=await refreshCommunitySnapshots(sql);expect(result).toHaveLength(4);expect(sql).toHaveBeenCalledTimes(4);
  const year=new Date().getUTCFullYear();expect(sql.mock.calls.map(call=>call[1])).toEqual([
   'discovery:rawg:all-time:0:v1',...Array.from({length:3},(_,index)=>`discovery:rawg:popular-in-year:${year-index}:v1`)]);
 });
 it('preserves old ranking snapshots during a provider outage and propagates database errors',async()=>{
  const sql=database();state.read.mockRejectedValue(new Error('offline'));
  expect((await refreshCommunitySnapshots(sql)).every(row=>!row.ok)).toBe(true);expect(sql).not.toHaveBeenCalled();
  state.read.mockResolvedValue({count:1,results:[game(1)]});sql.mockRejectedValue({code:'42501'});
  await expect(refreshCommunitySnapshots(sql)).rejects.toMatchObject({code:'42501'});
 });
});
