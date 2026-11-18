import { getPublicSupabase } from '@/lib/supabase/public';
import { readCommunityRanking } from './community-ranking';
import { isPublicSafeRawgGame, isPublicSafeGame } from '@/lib/utils/publicSafety';
import { isPrimaryDiscoveryGame } from '@/lib/utils/discovery';
import { hasEarlyAccessSignal } from '@/lib/utils/release-status';
import { isPortraitArtwork } from '@/lib/utils/artwork';
import type { RawgListResponse, RawgListGameItem } from '@/lib/api';

export async function loadProviderRanking(type:'all-time'|'popular-in-year',year:number,page:number,pageSize:number,platform:string,day:string):Promise<RawgListResponse> {
  const snapshot=await readCommunityRanking(type,year);
  const raw=snapshot.results.filter(item=>isPublicSafeRawgGame(item)
    && isPrimaryDiscoveryGame({title:item.name,description:''}) && item.released && item.released<=day
    && (type!=='popular-in-year' || item.released.startsWith(`${year}-`)));
  if(!raw.length)throw new Error('Empty eligible community ranking');
  const {data,error}=await getPublicSupabase().from('games')
    .select('rawg_id,slug,cover_image,header_image,steam_app_id,release_status,tags,genres,title,review_count')
    .in('rawg_id',raw.map(item=>item.id)).abortSignal(AbortSignal.timeout(3000));
  if(error)throw error;
  const byId=new Map((data||[]).map(row=>[row.rawg_id,row]));
  const seen=new Set<string>();
  const eligible=raw.filter(item=>{
    const local=byId.get(item.id);
    if(item.ratings_count<100 && (local?.review_count || 0)<100)return false;
    if(local && (!isPublicSafeGame(local) || hasEarlyAccessSignal(local) || ['announced','coming_soon','upcoming','tba','cancelled','canceled','delisted'].includes(local.release_status || '')))return false;
    // A bad historical Steam mapping must not collapse two distinct RAWG
    // games. Merge only matching title identities within a shared mapping.
    const titleIdentity=item.name.toLowerCase().replace(/[^a-z0-9]/g,'');
    const identity=local?.steam_app_id ? `steam:${local.steam_app_id}:${titleIdentity}` : `name:${titleIdentity}`;
    if(seen.has(identity))return false;
    seen.add(identity);return true;
  }).slice(0,250).map((item,index)=>({item,rank:index+1}));
  // Rank the eligible global cohort before platform filtering; positions stay
  // absolute on every page and platform. Provider platforms are authoritative
  // here: the historical Steam-heavy local rows can omit console versions.
  const filtered=eligible.filter(({item})=>!platform || item.platforms?.some(p=>p.platform.name===platform || platform==='Xbox Series X|S' && p.platform.name==='Xbox Series S/X'));
  const visible=filtered.slice((page-1)*pageSize,page*pageSize);
  const items:RawgListGameItem[]=visible.map(({item,rank})=>{
    const local=byId.get(item.id);
    const image=local && isPortraitArtwork(local.cover_image) ? local.cover_image : item.background_image;
    return {rawgId:item.id,slug:local?.slug || item.slug,name:item.name,image,imageKind:isPortraitArtwork(image)?'cover':'artwork',
      released:item.released,tba:item.tba,rating:item.rating,ratingsCount:item.ratings_count,metacritic:item.metacritic,
      added:item.added,toplay:item.added_by_status?.toplay || 0,playing:item.added_by_status?.playing || 0,owned:item.added_by_status?.owned || 0,
      platforms:(item.platforms||[]).map(p=>p.platform.name),genres:(item.genres||[]).map(g=>g.name),screenshots:[],clip:null,metricSource:'rawg',
      ...(type==='all-time'?{rank}:{}),};
  });
  return {source:'rawg',count:filtered.length,page,pageSize,hasNext:page*pageSize<filtered.length,items,fetchedAt:snapshot.fetchedAt,
    degraded:Date.now()-Date.parse(snapshot.fetchedAt)>43200_000,
    definition:`RAWG community order, with adult-only games, add-ons, duplicate editions and unreleased games excluded. Games need at least 100 ratings on RAWG or reviews in the Verdict catalogue.${type==='all-time'?' Platform filters keep each game’s overall position.':''} Displayed community ratings are from RAWG, not Steam.`};
}
