import { describe, it, expect } from 'vitest';
import postgres from 'postgres';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isPrimaryDiscoveryGame } from '@/lib/utils/discovery';
import { isPublicSafeGame } from '@/lib/utils/publicSafety';
import { dedupePublicCanonicalRows } from '@/lib/utils/publicCanonical';
import { confidenceWeightedScore } from '@/lib/utils/quality';
import { hasEarlyAccessSignal } from '@/lib/utils/release-status';
import type { GameRow } from '@/lib/supabase/types';

// Explicit opt-in: real historical public data stays in ignored local evidence.
// No production URL or environment credentials are ever used here.
describe.runIf(process.env.RUN_CATALOGUE_PARITY === '1')('Postgres catalogue parity on actual historical public records', () => {
  it('matches eligibility, canonical representatives, all orders and absolute filtered ranks', async () => {
    const status = JSON.parse(execFileSync(process.platform === 'win32' ? 'supabase.exe' : 'supabase', ['status','-o','json'], { encoding:'utf8',stdio:['ignore','pipe','pipe'] }));
    const address = new URL(status.DB_URL); expect(address.hostname).toBe('127.0.0.1'); address.pathname='/verdict_perf_20261115';
    const sql = postgres(address.href,{max:1,prepare:false});
    const source = JSON.parse(readFileSync('.verification/perf-public-catalogue.json','utf8')) as GameRow[];
    for (const row of source) if (row.release_date) row.release_date=row.release_date.slice(0,10);
    const day='2026-11-15', samples:Record<string,unknown>[]=[];
    const reference = (type:string, year:number, genre:string, sort:string, platform:string) => {
      const since='2026-10-16';
      let pool=source.filter(row=>{
        if(type==='best-of-year') {
          if(!(row.release_date && row.release_date>day) && !['announced','coming_soon','upcoming','tba','early_access'].includes(row.release_status||'')
            && !['Early Access','early-access','early access'].some(tag=>row.tags?.includes(tag))) return false;
        } else if(!row.release_date || row.release_date>day) return false;
        if(type==='popular-in-year' && (!row.release_date?.startsWith(String(year)) || (row.review_count||0)<100)) return false;
        if(type==='all-time' && (row.review_count||0)<100) return false;
        if(type==='recent' && (!row.release_date || row.release_date<since)) return false;
        if(type==='genre' && !row.genres?.includes(genre)) return false;
        return isPublicSafeGame(row) && isPrimaryDiscoveryGame(row) && !['cancelled','canceled','delisted'].includes(row.release_status||'')
          && (!['all-time','popular-in-year','recent'].includes(type) || !hasEarlyAccessSignal(row) && !['announced','coming_soon','upcoming','tba'].includes(row.release_status||''));
      });
      pool=dedupePublicCanonicalRows(pool);
      if(type==='genre' && sort==='rating') pool=pool.filter(row=>(row.review_count||0)>=100);
      const chosen=sort==='default' ? type==='recent' ? 'newest' : ['best-of-year','genre'].includes(type) ? 'popular' : 'rating' : sort;
      const compare = (a:GameRow,b:GameRow) => {
        let result=0;
        if(chosen==='rating') result=confidenceWeightedScore(b)-confidenceWeightedScore(a);
        if(chosen==='popular') result=(b.review_count||0)-(a.review_count||0);
        if(chosen==='name-asc') result=a.title.localeCompare(b.title);
        if(chosen==='name-desc') result=b.title.localeCompare(a.title);
        if(chosen==='newest') result=(b.release_date||'').localeCompare(a.release_date||'');
        if(chosen==='oldest') result=(a.release_date||'9999').localeCompare(b.release_date||'9999');
        if(chosen==='added') result=(b.created_at||'').localeCompare(a.created_at||'');
        return result || a.slug.localeCompare(b.slug);
      };
      pool.sort(compare);
      const ranked=pool.slice(0,type==='all-time'?250:undefined).map((row,index)=>({...row,rank:type==='all-time'?index+1:null}));
      return platform ? ranked.filter(row=>row.platforms?.includes(platform) || platform==='Xbox Series X|S' && row.platforms?.includes('Xbox Series S/X')) : ranked;
    };
    try {
      for(const [type,year,genre] of [['all-time',0,''],['popular-in-year',2025,''],['popular-in-year',2024,''],['recent',0,''],['genre',0,'Action'],['genre',0,'RPG'],['genre',0,'Adventure'],['best-of-year',0,'']] as const) {
        for(const sort of type==='all-time'?['default']:type==='best-of-year'?['default','name-asc','newest']:['default','rating','popular','name-asc','name-desc','newest','oldest','added']) {
          for(const platform of ['','PC','PlayStation 5','Xbox Series X|S']) {
            const expected=reference(type,year,genre,sort,platform);
            for(const page of [1,2,7]) {
              const start=performance.now();
              const [response]=await sql.unsafe('SELECT public.explore_catalogue_page($1,$2,$3,$4,$5,$6,40,$7::date) AS data',[type,year,genre,platform,sort,page,day]);
              const actual=response.data;
              const label=[type,genre,sort,platform,page].join('/');
              expect(actual.count,label+' count').toBe(expected.length);
              const slice=expected.slice((page-1)*40,page*40);
              expect(actual.rows.map((row:GameRow)=>row.slug),label).toEqual(slice.map(row=>row.slug));
              if(type==='all-time') expect(actual.rows.map((row:{rank:number})=>row.rank)).toEqual(slice.map(row=>row.rank));
              samples.push({type,year,genre,sort,platform,page,rows:actual.rows.length,count:actual.count,bytes:Buffer.byteLength(JSON.stringify(actual)),elapsedMs:Math.round((performance.now()-start)*100)/100});
            }
          }
        }
      }
      writeFileSync('output/targeted-release/sql-parity.json',JSON.stringify({source:'actual historical 8350-game public catalogue in disposable local database; not hosted latency',checks:samples.length,samples},null,2));
    } finally { await sql.end({timeout:1}); }
  },120000);
});
