import {describe,expect,it} from 'vitest';
import {collectRawgPages} from './rawg-discovery.mjs';
import {mapRawgPlatforms} from './rawg';
const game=(id:number)=>({id,name:`Game ${id}`,slug:`game-${id}`,released:'2025-01-01',tba:false,rating:4,ratings_count:10,added:100,genres:[],tags:[],platforms:[],background_image:null,description:'unneeded'.repeat(10000)});
describe('bounded complete RAWG cohorts',()=>{
  it('preserves provider-only previews when snapshot platforms contain only names', () => {
    expect(mapRawgPlatforms([{platform:{name:'PC'}}, {platform:{name:'Nintendo Switch 2'}},
      {platform:{slug:'xbox-series-x'}}, {platform:{name:'PC'}}, {}]))
      .toEqual(['PC', 'Nintendo Switch 2', 'Xbox Series X|S']);
  });
  it('collects the final six upcoming games beyond the provider 40-row cap and removes unused payload',async()=>{
    const pages:number[]=[];const value=await collectRawgPages(async page=>{pages.push(page);return {count:46,results:Array.from({length:page===1?40:6},(_,i)=>game((page-1)*40+i+1))};},1000);
    expect(pages).toEqual([1,2]);expect(value.results).toHaveLength(46);expect(value.complete).toBe(true);
    expect(value.results[45].id).toBe(46);expect(JSON.stringify(value)).not.toContain('unneeded');
  });
  it('keeps all 250 positions in provider order with at most two simultaneous requests',async()=>{
    let active=0,max=0;const value=await collectRawgPages(async page=>{
      active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,1));active--;
      return {count:250,results:Array.from({length:Math.min(40,250-(page-1)*40)},(_,i)=>game((page-1)*40+i+1))};
    });
    expect(value.results.map(row=>row.id)).toEqual(Array.from({length:250},(_,i)=>i+1));expect(max).toBe(2);
  });
  it.each(['truncated','duplicate','changed count','failure'])('rejects %s later pages instead of caching a partial ranking',async mode=>{
    await expect(collectRawgPages(async page=>{
      if(page===2 && mode==='failure')throw new Error('provider failed');
      return {count:page===2 && mode==='changed count'?99:46,results:Array.from({length:page===1?40:mode==='truncated'?1:6},(_,i)=>game(page===1?i+1:mode==='duplicate'?1:41+i))};
    })).rejects.toThrow();
  });
});
