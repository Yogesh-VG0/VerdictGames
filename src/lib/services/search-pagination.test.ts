import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({cache:new Map<string,unknown>(),depth:0,wideReads:0,cardReads:0,ranges:[] as number[][]}));
vi.mock('next/cache',()=>({unstable_cache:(fn:(...args:unknown[])=>unknown,keys:string[])=>(...args:unknown[])=>{
 // Next bypasses nested unstable_cache entries; mirror that documented runtime
 // boundary so putting the pool inside a response cache cannot pass this test.
 if(state.depth>0)return fn(...args);
 const key=JSON.stringify([keys,args]);if(!state.cache.has(key))state.cache.set(key,(async()=>{
  state.depth++;try{return await fn(...args);}finally{state.depth--;}
 })());return state.cache.get(key);
}}));
const rows=Array.from({length:300},(_,index)=>({id:`game-${index}`,slug:`game-${index}`,title:`Game ${index}`,steam_app_id:1000+index,
 release_date:'2020-01-01',created_at:'2020-01-01',platforms:['PC'],genres:['Action'],tags:['Singleplayer'],
 developer:'Studio',publisher:'Studio',cover_image:'https://images.igdb.com/co123.jpg',header_image:'https://images.igdb.com/co123.jpg',
 description:'A complete standalone action adventure with a substantial story.',score:90,verdict_score:90,confidence:0.9,
 review_count:1000000,steam_total_count:1000000,steam_positive_count:950000,current_players:1000+index,is_provisional:false,verdict_label:'MUST PLAY'}));
vi.mock('@/lib/supabase/public',()=>({hasPublicSupabaseEnv:()=>true,getPublicSupabase:()=>({from:()=>{
 const query:Record<string,unknown>={};let ids:string[]|undefined;let range=[0,999];
 for(const method of ['select','or','gte','gt','lte','not','neq','order','abortSignal','contains','eq'])query[method]=()=>query;
 query.in=(_field:string,values:string[])=>{ids=values;return query;};query.range=(a:number,b:number)=>{range=[a,b];return query;};
 query.then=(resolve:(value:unknown)=>unknown)=>{
  const data=ids?rows.filter(row=>ids!.includes(row.id)):rows.slice(range[0],range[1]+1);
  if(ids)state.cardReads++;else{state.wideReads++;state.ranges.push(range);}
  return Promise.resolve({data,error:null}).then(resolve);
 };return query;
}})}));
import {loadSearchResults} from './search';
describe('stable public Browse pagination and compact cohort cache',()=>{
 beforeEach(()=>{state.cache.clear();state.depth=0;state.wideReads=0;state.cardReads=0;state.ranges=[];});
 it('shares one ranked source cohort across four pages and transfers only page cards afterward',async()=>{
  const ids:string[]=[];
  for(let page=1;page<=4;page++) {
   const result=await loadSearchResults({query:'',platform:'All',genre:'',year:'',monetization:'All',sort:'relevance',page});
   expect(result.items).toHaveLength(25);ids.push(...result.items.map(row=>row.id));
  }
  expect(new Set(ids).size).toBe(100);expect(state.wideReads).toBe(1);expect(state.cardReads).toBe(4);expect(state.ranges).toEqual([[0,999]]);
  const cached=await Promise.all([...state.cache.values()]);
  const cohort=cached.find(value=>value && typeof value==='object' && 'ids' in value) as {ids:string[];totalIsExact:boolean};
  expect(Object.keys(cohort).sort()).toEqual(['ids','totalIsExact']);
  expect(JSON.stringify(cohort)).not.toContain('description');expect(Buffer.byteLength(JSON.stringify(cohort))).toBeLessThan(40000);
 });
});
