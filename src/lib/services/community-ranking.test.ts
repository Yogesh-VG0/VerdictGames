import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({stored:null as unknown,live:vi.fn(),keys:[] as string[]}));
vi.mock('next/cache',()=>({unstable_cache:(fn:unknown)=>fn}));
vi.mock('@/lib/external/rawg',()=>({getRawgCommunityRanking:state.live}));
vi.mock('@/lib/supabase/server',()=>({getServerSupabase:()=>({from:()=>{
 const query:Record<string,unknown>={};query.select=()=>query;query.abortSignal=()=>query;
 query.eq=(_name:string,key:string)=>{state.keys.push(key);return query;};query.maybeSingle=async()=>({data:state.stored,error:null});return query;
}})}));
import {readCommunityRanking} from './community-ranking';
const results=[{id:1,name:'A game',slug:'a-game',released:'2020-01-01',tba:false,rating:4,ratings_count:500,added:2000,tags:[],genres:[],platforms:[]}];
describe('durable RAWG ranking reads and bounded source cache keys',()=>{
 beforeEach(()=>{state.stored=null;state.live.mockReset();state.keys=[];vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','http://127.0.0.1');});
 afterEach(()=>vi.unstubAllEnvs());
 it('uses a fresh verified complete snapshot without contacting RAWG',async()=>{
  const fetched_at=new Date().toISOString();state.stored={payload:{results,complete:true,count:1},fetched_at};
  expect(await readCommunityRanking('all-time',2025)).toEqual({results,fetchedAt:fetched_at});expect(state.live).not.toHaveBeenCalled();
  expect(state.keys).toEqual(['discovery:rawg:all-time:0:v1']);
 });
 it('preserves actual freshness through a permanent outage',async()=>{
  state.stored={payload:{results,complete:true,count:1},fetched_at:'2020-01-01T00:00:00Z'};state.live.mockRejectedValue(new Error('offline'));
  expect((await readCommunityRanking('popular-in-year',2025)).fetchedAt).toBe('2020-01-01T00:00:00Z');
 });
 it('rejects a missing/corrupt durable snapshot if the live provider also fails',async()=>{
  state.stored={payload:{results,complete:true,count:250},fetched_at:new Date().toISOString()};state.live.mockRejectedValue(new Error('offline'));
  await expect(readCommunityRanking('all-time',0)).rejects.toThrow('offline');
 });
 it('bounds historical year keys before any provider or database read',()=>{
  for(const year of [1969,3000,2025.5,Number.NaN])expect(()=>readCommunityRanking('popular-in-year',year)).toThrow('Invalid ranking year');
  expect(state.keys).toEqual([]);expect(state.live).not.toHaveBeenCalled();
 });
});
