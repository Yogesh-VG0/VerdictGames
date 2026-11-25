import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({snapshot:vi.fn(),rows:[] as Record<string,unknown>[],error:null as unknown}));
vi.mock('./community-ranking',()=>({readCommunityRanking:state.snapshot}));
vi.mock('@/lib/supabase/public',()=>({getPublicSupabase:()=>({from:()=>{
  const query:Record<string,unknown>={};for(const name of ['select','in','abortSignal'])query[name]=()=>query;
  query.then=(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:state.rows,error:state.error}).then(resolve);return query;
}})}));
import {loadProviderRanking} from './provider-explore';
const game=(id:number)=>({id,name:`Game ${id}`,slug:`game-${id}`,released:'2025-01-01',tba:false,added:100-id,rating:4,ratings_count:200,background_image:'https://media.rawg.io/image.jpg',added_by_status:{},tags:[],genres:[],platforms:[{platform:{name:id%2?'PC':'PlayStation 5'}}]});
describe('RAWG default ranking and public boundaries',()=>{
  beforeEach(()=>{state.rows=[];state.error=null;state.snapshot.mockReset();state.snapshot.mockResolvedValue({results:Array.from({length:250},(_,i)=>game(i+1)),fetchedAt:new Date().toISOString()});});
  it('preserves provider order rather than re-sorting by Steam reviews or raw average',async()=>{
    const result=await loadProviderRanking('all-time',0,1,20,'','2026-11-18');
    expect(result.items.map(row=>row.rawgId)).toEqual(Array.from({length:20},(_,i)=>i+1));expect(result.items[0]).toMatchObject({rank:1,metricSource:'rawg',ratingsCount:200});
  });
  it.each([1,2,6,7])('keeps absolute ranks and no duplicate rows on platform page %i',async page=>{
    const result=await loadProviderRanking('all-time',0,page,20,'PlayStation 5','2026-11-18');
    expect(result.count).toBe(125);expect(result.items.map(row=>row.rank)).toEqual(Array.from({length:Math.min(20,Math.max(0,125-(page-1)*20))},(_,i)=>((page-1)*20+i+1)*2));
  });
  it('admits mainstream mature tags and excludes adult-only, future, add-ons and local Early Access records',async()=>{
    state.snapshot.mockResolvedValue({results:[{...game(1),name:'Grand Theft Auto',tags:[{name:'Nudity'},{name:'Sexual Content'}]},
      {...game(2),name:'Hentai Clicker'}, {...game(3),released:'2099-01-01'}, {...game(4),name:'Game Soundtrack'},game(5)],fetchedAt:new Date().toISOString()});
    state.rows=[{rawg_id:5,slug:'early',release_status:'early_access',tags:[]}];
    expect((await loadProviderRanking('all-time',0,1,20,'','2026-11-18')).items.map(row=>row.rawgId)).toEqual([1]);
  });
  it('uses the provider platform list even when the historical local record only lists PC',async()=>{
    state.rows=[{rawg_id:2,slug:'canonical-console',title:'Game 2',platforms:['PC']}];
    expect((await loadProviderRanking('all-time',0,1,20,'PlayStation 5','2026-11-18')).items[0].slug).toBe('canonical-console');
  });
  it('does not hide a database failure behind provider-only results',async()=>{
    state.error={code:'57014'};await expect(loadProviderRanking('all-time',0,1,20,'','2026-11-18')).rejects.toMatchObject({code:'57014'});
  });
  it('retains the review-evidence floor without relabelling Steam reviews as RAWG ratings',async()=>{
    state.snapshot.mockResolvedValue({results:[{...game(1),ratings_count:2},{...game(2),ratings_count:5}],fetchedAt:new Date().toISOString()});
    state.rows=[{rawg_id:2,slug:'tracked',review_count:5000}];
    const result=await loadProviderRanking('all-time',0,1,20,'','2026-11-18');
    expect(result.items.map(row=>row.rawgId)).toEqual([2]);expect(result.items[0].ratingsCount).toBe(5);
    expect(result.items[0].rank).toBe(2);
    expect(result.notice).toMatch(/1 of 2 RAWG positions qualify/);
  });
  it('keeps God of War 2018 on its canonical identity and selects its landscape art',async()=>{
    const background='https://media.rawg.io/media/games/4be/4be6a6ad0364751a96229c56bf69be59.jpg';
    state.snapshot.mockResolvedValue({results:[{...game(58175),name:'God of War (2018)',slug:'god-of-war-2',
      released:'2018-04-20',background_image:background}],fetchedAt:new Date().toISOString()});
    state.rows=[{id:'canonical-id',rawg_id:58175,steam_app_id:1593500,slug:'god-of-war-2018',release_status:'released',
      cover_image:background,header_image:'https://media.rawg.io/media/screenshots/e2e/e2e16b63691fab32fa20d99f3e6895a0.jpeg'}];
    expect((await loadProviderRanking('all-time',0,1,20,'','2026-11-18')).items[0]).toMatchObject({
      rawgId:58175,slug:'god-of-war-2018',catalogueId:'canonical-id',landscapeImage:background,landscapeImageKind:'artwork',
    });
  });
});
