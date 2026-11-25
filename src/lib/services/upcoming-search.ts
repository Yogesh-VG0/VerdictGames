import type {Game,PaginatedResponse} from '@/lib/types';
import type {RawgListGameItem} from '@/lib/api';
import type {SearchGamesState} from '@/lib/search';
import {normalizePlatforms} from '@/lib/utils/platform';
import {dedupePublicCanonicalRows} from '@/lib/utils/publicCanonical';
import {loadExplore} from './explore';
import {isPublicSafeGame} from '@/lib/utils/publicSafety';
import {isPrimaryDiscoveryGame} from '@/lib/utils/discovery';
import {boundedHomepageRead} from './homepage-budget';
import {coalesceCatalogueRead} from '@/lib/db/cached-catalogue';
import {compareUpcomingTiming,resolveReleaseTiming} from '@/lib/utils/release-timing';
import {matchReviewedPendingCatalogueRelease} from './reviewed-catalogue-releases';

export function upcomingCard(item:RawgListGameItem):Game {
  const today=new Date().toISOString().slice(0,10);
  const oldEarlyAccessDate=Boolean(item.earlyAccess && item.released && item.released<=today);
  const releaseTiming=item.releaseTiming ?? resolveReleaseTiming(item.released,{upcoming:true,tba:item.tba || oldEarlyAccessDate});
  return {
    id:item.catalogueId || `rawg-${item.rawgId}`,slug:item.slug,title:item.name,rawgId:item.rawgId,
    coverImage:item.image || '',headerImage:item.image || '',screenshots:[],
    platforms:normalizePlatforms(item.platforms),genres:item.genres,tags:item.tags || [],
    developer:'',publisher:'',releaseDate:oldEarlyAccessDate?'':item.released || '',
    releaseDateTba:releaseTiming.precision==='tba',releaseTiming,
    description:'',score:0,verdictLabel:'COMING SOON',verdictSummary:'',pros:[],cons:[],
    monetization:item.monetization || 'Unknown',performanceNotes:'',monetizationNotes:'',
    reviewCount:0,isProvisional:true,releaseStatus:item.earlyAccess?'early-access':'upcoming',
    isPreview:!item.catalogueId,previewSource:item.metricSource==='catalogue'?undefined:'rawg',
    scoreSource:item.metricSource==='catalogue'?undefined:'rawg',
  };
}

function matches(game:Game,state:SearchGamesState) {
  const query=state.query.toLowerCase();
  if(query && ![game.title,game.developer,game.publisher].some(value=>value.toLowerCase().includes(query)))return false;
  const families:Record<string,string[]>={'PlayStation 5':['PlayStation 5','PlayStation 4'],'Xbox Series X|S':['Xbox Series X|S','Xbox One'],'Nintendo Switch':['Nintendo Switch','Nintendo Switch 2']};
  if(state.platform!=='All' && !game.platforms.some(platform=>(families[state.platform] || [state.platform]).includes(platform)))return false;
  if(state.genre && ![...game.genres,...game.tags].some(genre=>genre.toLowerCase()===state.genre.toLowerCase()))return false;
  const timing=game.releaseTiming ?? resolveReleaseTiming(game.releaseDate,{upcoming:true,tba:game.releaseDateTba});
  if(state.year && (timing.precision==='tba' || timing.value.slice(0,4)!==state.year))return false;
  return state.monetization==='All' || game.monetization===state.monetization;
}

export function mergeUpcomingCards(local:Game[],discovered:Game[],state:SearchGamesState):Game[] {
  const byId=new Map(discovered.map(game=>[game.id,game]));
  for(const game of local){
    const provider=byId.get(game.id);
    const reviewed=matchReviewedPendingCatalogueRelease({slug:game.slug,rawg_id:game.rawgId??null,release_status:game.releaseStatus??null});
    const timing=reviewed?.timing ?? provider?.releaseTiming ?? game.releaseTiming;
    byId.set(game.id,provider?{...game,coverImage:provider.coverImage || game.coverImage,
      platforms:normalizePlatforms([...game.platforms,...provider.platforms]),
      releaseDate:reviewed ? game.releaseDate : provider.releaseDate,
      releaseDateTba:timing?.precision==='tba',releaseTiming:timing,
      releaseStatus:reviewed?.status ?? provider.releaseStatus,tags:[...new Set([...game.tags,...provider.tags])]}:game);
  }
  const candidates=[...byId.values()].filter(game=>isPublicSafeGame(game) && isPrimaryDiscoveryGame(game) && matches(game,state)).map(game=>({
    game,title:game.title,franchise:game.franchise || null,developer:game.developer,publisher:game.publisher,
    steam_app_id:game.steamAppId || null,current_players:game.currentPlayers || 0,
    verdict_score:game.verdictScore || 0,score:game.score,review_count:game.reviewCount,
    confidence:game.confidence || 0,release_date:game.releaseDate || null,
  }));
  return dedupePublicCanonicalRows(candidates,{query:state.query}).map(row=>row.game).sort((a,b)=>{
    const aTiming=a.releaseTiming ?? resolveReleaseTiming(a.releaseDate,{upcoming:true,tba:a.releaseDateTba});
    const bTiming=b.releaseTiming ?? resolveReleaseTiming(b.releaseDate,{upcoming:true,tba:b.releaseDateTba});
    return compareUpcomingTiming(aTiming,bTiming,false) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  });
}

/** Keep provider cache reads outside per-filter response caches. */
const readBrowseUpcoming = coalesceCatalogueRead(() => boundedHomepageRead(3500, () =>
  loadExplore('best-of-year', 1, 1000, undefined, 'action', 'oldest', '', undefined, { snapshotOnly: true })));

export async function loadUpcomingSearch(state:SearchGamesState,localRead:Promise<{cards?:Game[];totalIsExact:boolean}>):Promise<PaginatedResponse<Game>> {
  const [local,discovery]=await Promise.allSettled([localRead,readBrowseUpcoming()]);
  if(local.status==='rejected' && discovery.status==='rejected')throw local.reason;
  const providerCards = discovery.status === 'fulfilled' && !discovery.value.degraded ? discovery.value.items.map(upcomingCard) : [];
  const cards=mergeUpcomingCards(local.status==='fulfilled'?local.value.cards || []:[],providerCards,state);
  const bothAvailable=local.status==='fulfilled' && discovery.status==='fulfilled' && !discovery.value.degraded;
  const complete=bothAvailable && local.value.totalIsExact && discovery.value.count === discovery.value.items.length;
  const notice=complete ? undefined : bothAvailable ? 'Showing a bounded selection of eligible upcoming games.'
    : discovery.status==='fulfilled' && discovery.value.notice || (discovery.status==='rejected'
      ? 'Upcoming discovery is temporarily unavailable. Showing saved catalogue games.'
      : 'Some upcoming details are temporarily unavailable. Showing the games we could load.');
  const pageSize=25,start=(state.page-1)*pageSize;
  return {items:cards.slice(start,start+pageSize),total:cards.length,page:state.page,pageSize,hasMore:start+pageSize<cards.length,totalIsExact:complete,...(notice?{notice}:{})};
}
