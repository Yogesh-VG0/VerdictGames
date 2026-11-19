import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({rows:[] as Record<string,unknown>[],filters:[] as unknown[][]}));
vi.mock('next/cache',()=>({unstable_cache:(fn:unknown)=>fn}));
vi.mock('@/lib/supabase/public',()=>({hasPublicSupabaseEnv:()=>true,getPublicSupabase:()=>({from:()=>{
 const query:Record<string,unknown>={};let ids:string[]|undefined;let columns='';
 for(const method of ['or','gte','gt','lte','not','neq','order','contains','eq'])query[method]=(...args:unknown[])=>{state.filters.push([method,...args]);return query;};
 for(const method of ['abortSignal','range'])query[method]=()=>query;
 query.select=(value:string)=>{columns=value;return query;};query.in=(_key:string,value:string[])=>{ids=value;return query;};
 query.then=(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:state.rows.filter(row=>!ids||ids.includes(String(row.id))).map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>columns.split(',').includes(key)))),error:null}).then(resolve);
 return query;
}})}));
import {loadSearchResults} from './search';
const request={query:'',platform:'All',genre:'',year:'',monetization:'All',sort:'newest',page:1} as const;
const launch={id:'console-launch',slug:'console-launch',title:'Console Launch',release_date:'2026-11-19',
 platforms:['PlayStation 5','Xbox Series X|S'],genres:['Action'],tags:['Nudity'],description:'A standalone open-world action adventure.',
 cover_image:'https://images.igdb.com/co123.jpg',header_image:'https://images.igdb.com/co123.jpg',
 score:77,verdict_score:77,confidence:0.245543,review_count:104,score_source:'igdb',critic_score:98,critic_source_count:1,release_status:null};
describe('Newest release-date eligibility',()=>{
 afterEach(()=>vi.useRealTimers());
 beforeEach(()=>{state.rows=[];state.filters=[];vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-19T12:00:00Z'));});
 it('includes a mainstream console launch with limited evidence without changing its Verdict',async()=>{
  state.rows=[launch];const result=await loadSearchResults(request);
  expect(result.items).toHaveLength(1);expect(result.items[0]).toMatchObject({score:77,criticScore:98});
  expect(state.filters).toContainEqual(['neq','verdict_label','COMING SOON']);
 });
 it('does not call a provisional past-date record a released game',async()=>{
  state.rows=[{...launch,release_date:'2026-10-22',id:'pending-enrichment',review_count:0,verdict_label:'COMING SOON',is_provisional:true}];
  expect((await loadSearchResults(request)).items).toEqual([]);
 });
 it('rejects future, explicitly unreleased, cancelled and adult-only records',async()=>{
  state.rows=[{...launch,release_date:'2027-01-01'},{...launch,id:'unreleased',release_status:'upcoming'},
   {...launch,id:'announced',release_status:'announced'},{...launch,id:'tba',release_status:'coming_soon'},
   {...launch,id:'cancelled',release_status:'cancelled'},{...launch,id:'adult',title:'Hentai Clicker'}];
  expect((await loadSearchResults(request)).items).toEqual([]);
 });
 it('retains exact platform predicates on the initial and hydration reads',async()=>{
  state.rows=[launch];await loadSearchResults({...request,platform:'PlayStation 5'});
  expect(state.filters).toContainEqual(['or','platforms.cs.{PlayStation 5},platforms.cs.{PlayStation 4}']);
  expect(state.filters.some(filter=>filter[0]==='contains' && JSON.stringify(filter).includes('PC'))).toBe(false);
 });
});
