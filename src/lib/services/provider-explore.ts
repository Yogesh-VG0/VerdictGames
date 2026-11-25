import { getPublicSupabase } from '@/lib/supabase/public';
import { readCommunityRanking } from './community-ranking';
import { isPublicSafeRawgGame, isPublicSafeGame } from '@/lib/utils/publicSafety';
import { isPrimaryDiscoveryGame } from '@/lib/utils/discovery';
import { hasEarlyAccessSignal, hasUnreleasedStatus } from '@/lib/utils/release-status';
import { selectCatalogueArtwork } from '@/lib/utils/artwork';
import type { RawgListResponse, RawgListGameItem } from '@/lib/api';

export async function loadProviderRanking(type:'all-time'|'popular-in-year',year:number,page:number,pageSize:number,platform:string,day:string):Promise<RawgListResponse> {
  const snapshot=await readCommunityRanking(type,year);
  const raw=snapshot.results.slice(0, 250).map((item,index)=>({item,rank:index+1})).filter(({item})=>isPublicSafeRawgGame(item)
    && isPrimaryDiscoveryGame({title:item.name,description:''}) && !item.tba && item.released && item.released<=day
    && (type!=='popular-in-year' || item.released.startsWith(`${year}-`)));
  if(!raw.length)throw new Error('Empty eligible community ranking');
  const {data,error}=await getPublicSupabase().from('games')
    .select('id,rawg_id,slug,cover_image,header_image,steam_app_id,is_featured_manual,release_status,tags,genres,title')
    .in('rawg_id',raw.map(({item})=>item.id)).abortSignal(AbortSignal.timeout(3000));
  if(error)throw error;
  const byId=new Map((data||[]).map(row=>[row.rawg_id,row]));
  const seen=new Set<string>();
  const eligible=raw.filter(({item})=>{
    const local=byId.get(item.id);
    if(local && (!isPublicSafeGame(local) || hasEarlyAccessSignal(local) || hasUnreleasedStatus(local)))return false;
    // A bad historical Steam mapping must not collapse two distinct RAWG
    // games. Merge only matching title identities within a shared mapping.
    const titleIdentity=item.name.toLowerCase().replace(/[^a-z0-9]/g,'');
    const identity=local?.steam_app_id ? `steam:${local.steam_app_id}:${titleIdentity}` : `name:${titleIdentity}`;
    if(seen.has(identity))return false;
    seen.add(identity);return true;
  });
  // Rank the eligible global cohort before platform filtering; positions stay
  // absolute on every page and platform. Provider platforms are authoritative
  // here: the historical Steam-heavy local rows can omit console versions.
  const filtered=eligible.filter(({item})=>!platform || item.platforms?.some(p=>p.platform.name===platform || platform==='Xbox Series X|S' && p.platform.name==='Xbox Series S/X'));
  const visible=filtered.slice((page-1)*pageSize,page*pageSize);
  const items:RawgListGameItem[]=visible.map(({item,rank})=>{
    const local=byId.get(item.id);
    return {rawgId:item.id,slug:local?.slug || item.slug,name:item.name,catalogueId:local?.id,...selectCatalogueArtwork(local,item.background_image),
      released:item.released,tba:item.tba,rating:item.rating,ratingsCount:item.ratings_count,metacritic:item.metacritic,
      added:item.added,toplay:item.added_by_status?.toplay || 0,playing:item.added_by_status?.playing || 0,owned:item.added_by_status?.owned || 0,
      platforms:(item.platforms||[]).map(p=>p.platform.name),genres:(item.genres||[]).map(g=>g.name),screenshots:[],clip:null,metricSource:'rawg',
      ...(type==='all-time'?{rank}:{}),};
  });
  const stale=Date.now()-Date.parse(snapshot.fetchedAt)>43200_000;
  const notices = [
    stale ? 'Showing saved RAWG rankings while we check for updates.' : '',
    type==='all-time' && eligible.length<250 ? `${eligible.length} of ${snapshot.results.length} RAWG positions qualify. Excluded entries leave gaps in the original ranking.` : '',
  ].filter(Boolean).join(' ');
  return {source:'rawg',count:filtered.length,page,pageSize,hasNext:page*pageSize<filtered.length,items,fetchedAt:snapshot.fetchedAt,
    degraded:stale,...(notices ? {notice:notices} : {}),
    definition:`RAWG community order, with adult-only games, add-ons, duplicate editions and unreleased games excluded.${type==='all-time'?' Platform filters keep each game’s overall position.':''} Ratings and rating counts are shown when RAWG provides rating evidence.`};
}
