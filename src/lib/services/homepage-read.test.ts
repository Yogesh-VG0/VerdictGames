import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({responses:[] as unknown[]}));
vi.mock('next/cache',()=>({unstable_cache:(read:unknown)=>read}));
vi.mock('@/lib/supabase/public',()=>({getPublicSupabase:()=>({from:()=>{
  const chain:Record<string,unknown>={};
  for(const key of ['select','eq','not','neq','gte','lte','gt','order','limit'])chain[key]=()=>chain;
  chain.then=(resolve:(value:unknown)=>unknown,reject:(error:unknown)=>unknown)=>Promise.resolve(state.responses.shift()).then(resolve,reject);
  return chain;
}})}));
import {fetchTrendingGames} from './homepage';
describe('homepage trending read failures',()=>{
 beforeEach(()=>{state.responses=[]});
 it('propagates a failed candidate pool rather than caching a successful empty rail',async()=>{
  const error={code:'57014',message:'Controlled statement cancellation'};
  state.responses=[{data:[],error:null},{data:null,error}];
  await expect(fetchTrendingGames(100,true)).rejects.toBe(error);
  expect(state.responses).toHaveLength(0);
 });
 it('still accepts a genuinely empty successful candidate pool',async()=>{
  state.responses=[{data:[],error:null},{data:[],error:null}];
  await expect(fetchTrendingGames(100,true)).resolves.toEqual([]);
 });
});
