import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const state = vi.hoisted(() => ({
  cache: new Map<string, Promise<unknown>>(), calls: [] as {columns:string; ids?:string[]; filters:unknown[][]; range:number[]}[],
  active: 0, peak: 0, failChunk: false, failClassificationFallback:false, bypassCache:false,
}));
vi.mock('next/cache', () => ({unstable_cache: (fn:(...args:unknown[])=>Promise<unknown>, keys:string[]) => (...args:unknown[]) => {
  if (state.bypassCache) return fn(...args);
  const key = JSON.stringify([keys, args]);
  if (!state.cache.has(key)) {
    const pending = fn(...args).catch(error => {state.cache.delete(key); throw error;});
    state.cache.set(key, pending);
  }
  return state.cache.get(key);
}}));
const rows = Array.from({length:1000}, (_, index) => ({
  id:`game-${index}`, slug:`game-${index}`, title:`Game ${index}`, steam_app_id:1000+index,
  release_date:'2025-01-01', created_at:new Date(Date.UTC(2026, 0, 1, 0, 0, 1000-index)).toISOString(),
  platforms:['PC'], genres:['Action'], tags:['Singleplayer'], developer:'Studio', publisher:'Studio',
  cover_image:'https://images.igdb.com/co123.jpg', header_image:'https://images.igdb.com/co123.jpg',
  description:'A complete standalone action adventure with a substantial story.',
  score:90, verdict_score:90, confidence:0.9, review_count:1000000, steam_total_count:1000000,
  steam_positive_count:950000, current_players:1000, momentum:0.2, is_provisional:false, verdict_label:'MUST PLAY',
  explore_primary_safe:true as boolean|null,
}));
vi.mock('@/lib/supabase/public', () => ({hasPublicSupabaseEnv:()=>true, getPublicSupabase:()=>({from:()=>{
  const query:Record<string,unknown> = {};
  let ids:string[]|undefined, columns='', range=[0,999];
  let signal:AbortSignal;
  const filters:unknown[][]=[];
  for (const method of ['or','gte','gt','lte','not','neq','order','contains','eq']) {
    query[method]=(...args:unknown[])=>{filters.push([method,...args]);return query;};
  }
  query.abortSignal=(value:AbortSignal)=>{signal=value;return query;};
  query.select=(value:string)=>{columns=value;return query;};
  query.in=(_field:string,values:string[])=>{ids=values;return query;};
  query.range=(a:number,b:number)=>{range=[a,b];return query;};
  query.then=(resolve:(value:unknown)=>unknown, reject:(error:unknown)=>unknown)=>{
    state.calls.push({columns,ids,filters,range});
    return (async()=>{
      const hydration=Boolean(ids && ids.length>25);
      if(hydration){state.active++;state.peak=Math.max(state.peak,state.active);}
      try {
        await new Promise(done=>setTimeout(done,2));
        signal.throwIfAborted();
        if(state.failChunk && ids?.includes('game-200'))return {data:null,error:{code:'57014'}};
        if(state.failClassificationFallback && columns.includes('description'))return {data:null,error:{code:'57014'}};
        // Hydration is deliberately unordered: the loader must restore the ID cohort.
        const selected=ids?rows.filter(row=>ids!.includes(row.id)).reverse():rows.slice(range[0],range[1]+1);
        return {data:selected.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>columns.split(',').includes(key)))),error:null};
      } finally {if(hydration)state.active--;}
    })().then(resolve,reject);
  };
  return query;
}})}));
import {loadSearchResults} from './search';

const request = {query:'',platform:'All',genre:'',year:'',monetization:'All',sort:'recently-added',page:1} as const;
describe('bounded Recently Added cohort',()=>{
  beforeEach(()=>{
    state.cache.clear();state.calls=[];state.active=0;state.peak=0;state.failChunk=false;state.failClassificationFallback=false;state.bypassCache=false;
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-19T12:00:00Z'));
  });
  it('fails closed if missing-classification metadata cannot be read',async()=>{
    const prior=rows[0].explore_primary_safe;
    try{
      rows[0].explore_primary_safe=null;state.failClassificationFallback=true;
      await expect(loadSearchResults(request)).rejects.toEqual({code:'57014'});
      expect(state.cache.size).toBe(0);
    }finally{rows[0].explore_primary_safe=prior;}
  });
  afterEach(()=>vi.useRealTimers());
  it('keeps all 1,000 candidates, restores their order and shares the cohort across pages',async()=>{
    const first=await loadSearchResults(request);
    const second=await loadSearchResults({...request,page:2});
    expect(first.total).toBe(1000);expect(first.totalIsExact).toBe(false);
    expect(first.items.map(row=>row.id)).toEqual(rows.slice(0,25).map(row=>row.id));
    expect(second.items.map(row=>row.id)).toEqual(rows.slice(25,50).map(row=>row.id));
    const initial=state.calls.filter(call=>!call.ids);
    expect(initial).toHaveLength(1);expect(initial[0].columns).toBe('id');expect(initial[0].range).toEqual([0,999]);
    const chunks=state.calls.filter(call=>call.ids && call.ids.length>25);
    expect(chunks.map(call=>call.ids!.length)).toEqual([200,200,200,200,200]);
    expect(state.peak).toBe(2);
    expect(chunks.every(call=>!call.columns.includes('description') && call.columns.includes('explore_primary_safe'))).toBe(true);
  });
  it('loads original full safety metadata for an unclassified row and excludes classified unsafe rows',async()=>{
    const first=rows[0].explore_primary_safe,second=rows[1].explore_primary_safe;
    try{
      rows[0].explore_primary_safe=null;rows[1].explore_primary_safe=false;
      const result=await loadSearchResults(request);
      expect(result.items.some(row=>row.id==='game-0')).toBe(true);
      expect(result.items.some(row=>row.id==='game-1')).toBe(false);
      expect(state.calls.some(call=>call.ids?.length===1 && call.ids[0]==='game-0' && call.columns.includes('description'))).toBe(true);
    }finally{rows[0].explore_primary_safe=first;rows[1].explore_primary_safe=second;}
  });
  it('reapplies platform and release-year filters to every bounded read',async()=>{
    const result=await loadSearchResults({...request,platform:'PC',year:'2025'});
    expect(result.items).toHaveLength(25);
    expect(state.calls).toHaveLength(6);
    for(const call of state.calls){
      expect(call.filters).toContainEqual(['contains','platforms',['PC']]);
      expect(call.filters).toContainEqual(['gte','release_date','2025-01-01']);
      expect(call.filters).toContainEqual(['lte','release_date','2025-12-31']);
      expect(call.filters).toContainEqual(['order','created_at',{ascending:false}]);
    }
  });
  it('also bounds the demonstrated 750-row Trending cohort without changing its size',async()=>{
    const result=await loadSearchResults({...request,sort:'trending'});
    expect(result.total).toBe(750);expect(result.totalIsExact).toBe(false);
    expect(result.items.map(row=>row.id)).toEqual(rows.slice(0,25).map(row=>row.id));
    expect(state.calls[0].columns).toBe('id');expect(state.calls[0].range).toEqual([0,749]);
    const chunks=state.calls.filter(call=>call.ids && call.ids.length>25);
    expect(chunks.map(call=>call.ids!.length)).toEqual([200,200,200,150]);
    expect(state.peak).toBe(2);
    for(const call of state.calls.slice(0,-1)){
      expect(call.filters).toContainEqual(['order','is_trending_manual',{ascending:false,nullsFirst:false}]);
    }
  });
  it('coalesces simultaneous cohort refreshes even when the framework starts each callback',async()=>{
    state.bypassCache=true;
    const results=await Promise.all([1,2,3].map(page=>loadSearchResults({...request,page})));
    expect(results.every(result=>result.total===1000)).toBe(true);
    expect(new Set(results.flatMap(result=>result.items.map(row=>row.id))).size).toBe(75);
    expect(state.calls.filter(call=>!call.ids)).toHaveLength(1);
    expect(state.calls.filter(call=>call.ids && call.ids.length>25)).toHaveLength(5);
    expect(state.peak).toBe(2);
  });
  it('bounds 500-row sorts after the same wide-read failure was observed in Top Rated',async()=>{
    const result=await loadSearchResults({...request,sort:'top-rated'});
    expect(result.total).toBe(500);expect(result.totalIsExact).toBe(false);
    expect(result.items.map(row=>row.id)).toEqual(rows.slice(0,25).map(row=>row.id));
    expect(state.calls[0].columns).toBe('id');expect(state.calls[0].range).toEqual([0,499]);
    expect(state.calls.filter(call=>call.ids && call.ids.length>25).map(call=>call.ids!.length)).toEqual([200,200,100]);
    expect(state.peak).toBe(2);
  });
  it('fails the entire read on a chunk error and does not retain a partial success',async()=>{
    state.failChunk=true;
    await expect(loadSearchResults(request)).rejects.toEqual({code:'57014'});
    await new Promise(done=>setTimeout(done,5));
    expect(state.active).toBe(0);
    expect(state.cache.size).toBe(0);
    state.failChunk=false;
    expect((await loadSearchResults(request)).total).toBe(1000);
  });
});
