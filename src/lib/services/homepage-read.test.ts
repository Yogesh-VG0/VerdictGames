import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({responses:[] as unknown[]}));
vi.mock('next/cache',()=>({unstable_cache:(read:unknown)=>read}));
vi.mock('@/lib/supabase/public',()=>({getPublicSupabase:()=>({from:()=>{
  const chain:Record<string,unknown>={};
  for(const key of ['select','eq','not','neq','gte','lte','gt','order','limit'])chain[key]=()=>chain;
  chain.then=(resolve:(value:unknown)=>unknown,reject:(error:unknown)=>unknown)=>Promise.resolve(state.responses.shift()).then(resolve,reject);
  return chain;
}})}));
import {fetchTrendingGames,fetchNewReleases} from './homepage';
describe('homepage trending read failures',()=>{
 beforeEach(()=>{state.responses=[]});
 it('never shows Coming Soon inside New Releases, while preserving a low-confidence console launch',async()=>{
  const launch={id:'launch',slug:'launch',title:'Console Launch',description:'A standalone action adventure with an open world.',
   release_date:new Date().toISOString().slice(0,10),cover_image:'https://images.igdb.com/co123.jpg',header_image:'https://images.igdb.com/co123.jpg',
   platforms:['PlayStation 5'],genres:['Action'],tags:['Nudity'],score:77,verdict_score:77,confidence:0.245543,review_count:104,
   developer:'Studio',publisher:'Studio',score_source:'igdb',critic_score:98,critic_source_count:1,verdict_label:'WORTH IT'};
  const pending={...launch,id:'pending',title:'Unconfirmed Release',release_date:'2025-01-01',review_count:1000,is_provisional:true};
  const rows=[launch,pending];state.responses=[{data:rows,error:null},{data:rows,error:null}];
  const result=await fetchNewReleases(10);
  expect(result.map(game=>game.id)).toEqual(['launch']);expect(result[0].score).toBe(77);
 });
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
