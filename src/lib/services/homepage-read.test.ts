import {beforeEach,describe,expect,it,vi} from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HeroCarousel from '@/components/HeroCarousel';
const state=vi.hoisted(()=>({responses:[] as unknown[],discovery:[] as unknown[]}));
vi.mock('@/lib/services/upcoming-snapshot',()=>({readCachedUpcomingSnapshot:async()=>({results:state.discovery})}));
vi.mock('@/lib/services/community-ranking',()=>({readHomepageReleaseRanking:async()=>null}));
vi.mock('next/cache',()=>({unstable_cache:(read:unknown)=>read}));
vi.mock('@/lib/supabase/public',()=>({getPublicSupabase:()=>({from:()=>{
  const chain:Record<string,unknown>={};
  for(const key of ['select','eq','not','neq','gte','lte','gt','order','limit','in','abortSignal'])chain[key]=()=>chain;
  chain.then=(resolve:(value:unknown)=>unknown,reject:(error:unknown)=>unknown)=>Promise.resolve(state.responses.shift()).then(resolve,reject);
  return chain;
}})}));
import {fetchTrendingGames,fetchNewReleases,fetchHeroCandidates} from './homepage';
describe('homepage trending read failures',()=>{
 beforeEach(()=>{state.responses=[];state.discovery=[]});
 it('uses discovery to select a hero without replacing the canonical Verdict or adding reads per slide',async()=>{
   const today=new Date().toISOString().slice(0,10);
   const base={release_date:today,description:'A standalone action adventure with substantial review coverage.',
    cover_image:'https://images.igdb.com/co123.jpg',header_image:'https://images.igdb.com/scene.jpg',
    platforms:['PC'],genres:['Action'],tags:[],score:95,verdict_score:95,confidence:0.9,
    review_count:100000,steam_total_count:100000,steam_app_id:123,user_score:95,
    current_players:10000,developer:'Studio',publisher:'Studio',verdict_label:'MUST PLAY'};
   const rows=Array.from({length:6},(_,i)=>({...base,id:`hero-${i}`,slug:`hero-${i}`,title:`Hero ${i}`,steam_app_id:100+i}));
   Object.assign(rows[0], {
     title: 'Legacy Spotlight',
     description: 'Legacy Spotlight is an upcoming action adventure with a substantial open world.',
     release_date: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
     is_provisional: false,
   });
   const launch={...base,id:'launch',rawg_id:972995,igdb_id:52189,slug:'grand-theft-auto-vi',title:'Grand Theft Auto VI',steam_app_id:null,
    steam_total_count:null,user_score:null,score:77,verdict_score:77,confidence:0.245543,review_count:104};
   state.discovery=[{id:972995,name:'Grand Theft Auto VI',slug:'grand-theft-auto-vi',released:today,tba:false,added:1000,
    background_image:base.header_image,tags:[],genres:[],platforms:[]}];
   state.responses=[{data:rows,error:null},{data:[],error:null},{data:rows,error:null},{data:[launch],error:null}];
   const result=await fetchHeroCandidates(6);
   expect(result).toHaveLength(6);expect(result[0]).toMatchObject({id:'launch',score:77,verdictScore:77,verdictLabel:'WORTH IT',isProvisional:false});
   expect(result[0].headerImage).toContain('/ar6i4p.jpg');
   expect(result[0].description).toContain('Vice City');
   const spotlight = result.find(game => game.id === 'hero-0');
   expect(spotlight).toMatchObject({ description: '' });
   const markup = renderToStaticMarkup(createElement(HeroCarousel, { games: [spotlight!] }));
   expect(markup).toContain('Legacy Spotlight');
   expect(markup).toContain('based on the available rating evidence');
   expect(markup).not.toContain('is an upcoming action adventure');
   expect(state.responses).toHaveLength(0);
 });
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
 it('keeps a verified release without ratings instead of requiring a quality score',async()=>{
  const row={id:'unrated-release',slug:'unrated-release',title:'Unrated Release',description:'A complete standalone role playing game.',
   release_date:new Date(Date.now()-29*86400000).toISOString().slice(0,10),release_status:'released',
   cover_image:'https://images.igdb.com/co123.jpg',platforms:['PC'],genres:['RPG'],tags:[],score:60,verdict_score:0,
   review_count:0,developer:'Studio',publisher:'Studio',score_source:'rawg'};
  state.responses=[{data:[row],error:null}];
  expect(await fetchNewReleases(20)).toMatchObject([{id:'unrated-release',score:0,verdictLabel:'NOT YET RATED'}]);
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
