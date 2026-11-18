import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({search:vi.fn(),detail:vi.fn(),row:null as unknown}));
vi.mock('next/cache',()=>({unstable_cache:(fn:unknown)=>fn}));
vi.mock('react',()=>({cache:(fn:unknown)=>fn}));
vi.mock('@/lib/external/rawg',()=>({searchRawg:state.search,getRawgGame:state.detail,getRawgScreenshots:async()=>[],getRawgStoreLinks:async()=>[],mapRawgPlatforms:()=>[]}));
vi.mock('@/lib/supabase/public',()=>({hasPublicSupabaseEnv:()=>true,getPublicSupabase:()=>({from:()=>{
 const query:Record<string,unknown>={};for(const method of ['select','or','gte','gt','lte','not','neq','order','range','abortSignal','contains','eq'])query[method]=()=>query;
 query.maybeSingle=async()=>({data:state.row,error:null});query.then=(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:[],error:null}).then(resolve);return query;
}})}));
import {loadSearchResults} from './search';
import {loadGameDetail} from './game-detail';
import {isUpcomingCuratedListGame} from '@/lib/utils/curatedLists';
import type {GameRow} from '@/lib/supabase/types';
const provider=(id:number,name:string)=>({id,name,slug:`game-${id}`,released:'2099-01-01',rating:0,ratings_count:0,genres:[],tags:[],platforms:[]});
describe('consistent discovery content and release boundaries',()=>{
 beforeEach(()=>{state.search.mockReset();state.detail.mockReset();state.row=null;});
 it('keeps explicit content and add-ons out of RAWG search fallback and does not invent upcoming scores',async()=>{
  state.search.mockResolvedValue({results:[{...provider(1,'Grand Theft Auto VI'),tags:[{name:'Nudity'}]},provider(2,'Hentai Clicker'),provider(3,'Adventure Soundtrack')]});
  const result=await loadSearchResults({query:'new title',platform:'All',genre:'',year:'',monetization:'All',sort:'relevance',page:1});
  expect(result.items.map(row=>row.title)).toEqual(['Grand Theft Auto VI']);
  expect(result.items[0]).toMatchObject({score:0,isPreview:true,isProvisional:true,verdictLabel:'COMING SOON',scoreSource:'rawg'});
 });
 it('rejects an explicit provider detail before fetching screenshots and store links',async()=>{
  state.search.mockResolvedValue({results:[provider(2,'Hentai Clicker')]});state.detail.mockResolvedValue({...provider(2,'Hentai Clicker'),description_raw:''});
  expect((await loadGameDetail({slug:'game-2'})).status).toBe('not-found');
 });
 it('does not let a known full release remain in an upcoming collection because of old tags or flags',()=>{
  const row={release_status:'released',release_date:'2020-01-01',tags:['Early Access'],genres:[],is_provisional:true,verdict_label:'COMING SOON'} as unknown as GameRow;
  expect(isUpcomingCuratedListGame(row)).toBe(false);
  expect(isUpcomingCuratedListGame({...row,release_status:'early_access',is_provisional:false,verdict_label:'WORTH IT'})).toBe(true);
 });
});
