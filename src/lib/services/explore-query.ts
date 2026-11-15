import { unstable_cache } from 'next/cache';
import { getPublicSupabase } from '@/lib/supabase/public';
import type { GameRow } from '@/lib/supabase/types';
import type { ExploreSort, RawgListType } from '@/lib/api';

export interface CataloguePage {
  count: number;
  fetchedAt: string;
  rows: (GameRow & { ranking_score: number; rank: number | null })[];
}
class MissingCatalogueQuery extends Error {}
let missingUntil = 0;

async function query(type:RawgListType, year:number, genre:string, platform:string, sort:ExploreSort, page:number, pageSize:number, day:string):Promise<CataloguePage> {
  const { data, error } = await getPublicSupabase().rpc('explore_catalogue_page', {
    p_type:type,p_year:year,p_genre:genre,p_platform:platform,p_sort:sort,p_page:page,p_page_size:pageSize,p_day:day,
  }).abortSignal(AbortSignal.timeout(5000));
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') throw new MissingCatalogueQuery();
    // An outage must not fan out into 20+ fallback reads.
    throw error;
  }
  const value=data as unknown as CataloguePage;
  if (!value || !Number.isSafeInteger(value.count) || value.count<0 || !Number.isFinite(Date.parse(value.fetchedAt))
    || !Array.isArray(value.rows) || value.rows.length>pageSize
    || value.rows.some(row=>!row || typeof row.slug!=='string' || typeof row.title!=='string'
      || !Number.isFinite(row.ranking_score)
      || type==='all-time' && (!Number.isInteger(row.rank) || row.rank!<1 || row.rank!>250))) {
    throw new Error('Invalid catalogue query response');
  }
  return value;
}

// Cache only the small, common first three pages. Filter/sort/page-size
// permutations use the bounded SQL read and existing public CDN cache instead
// of multiplying framework cache entries or retaining whole catalogues.
const cached = unstable_cache(query,['public-explore-sql-v1'],{revalidate:300,tags:['public-explore']});
export async function readCataloguePage(type:RawgListType, year:number, genre:string, platform:string, sort:ExploreSort, page:number, pageSize:number, day:string):Promise<CataloguePage|null> {
  if (Date.now()<missingUntil) return null;
  try {
    const currentYear=Number(day.slice(0,4));
    const commonYear=type!=='popular-in-year' || year>=currentYear-2 && year<=currentYear;
    const read=commonYear && page<=3 && pageSize===20 && platform==='' && sort==='default' ? cached : query;
    return await read(type,type==='popular-in-year'?year:0,type==='genre'?genre:'',platform,sort,page,pageSize,day);
  } catch (error) {
    if (!(error instanceof MissingCatalogueQuery)) throw error;
    // Compatibility with the currently deployed schema, until the additive
    // function is explicitly approved/applied. Never cache an outage as absence.
    missingUntil=Date.now()+60_000;
    return null;
  }
}
