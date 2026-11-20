import { isPublicContentAllowed } from '../utils/public-safety.mjs';
// Essential metadata only. Provider ratings/hypes are never relabeled as RAWG
// interest, Steam reviews or a computed Verdict Score.
const genres={'Role-playing (RPG)':'RPG',Platform:'Platformer',Simulator:'Simulation',Sport:'Sports',
  'Real Time Strategy (RTS)':'Strategy','Turn-based strategy (TBS)':'Strategy',"Hack and slash/Beat 'em up":'Action'};
const platforms={'PC (Microsoft Windows)':'PC',PC:'PC','PlayStation 5':'PlayStation 5','PlayStation 4':'PlayStation 4',
  'Xbox Series X|S':'Xbox Series X|S','Xbox One':'Xbox One','Nintendo Switch':'Nintendo Switch',
  'Nintendo Switch 2':'Nintendo Switch 2',Android:'Android',iOS:'iOS',Mac:'macOS',Linux:'Linux'};
const image=id=>typeof id==='string'&&/^[a-zA-Z0-9_]{1,128}$/.test(id)?'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/'+id+'.jpg':'';
// Reuse explicit provider lifecycle evidence in both ingestion paths. Unknown
// status must not erase a reviewed catalogue correction or become "released"
// merely because an estimated date has passed.
export function igdbVerifiedReleaseFields(game, now=new Date(), currentStatus) {
  const record=igdbEssentialRecord(game,now);
  if(!record || !['released','early_access','cancelled','delisted'].includes(record.release_status))return {};
  const current=String(currentStatus||'').toLowerCase().replace(/[-_]/g,' ');
  if(['cancelled','canceled'].includes(current) || ['released','full release'].includes(current) && record.release_status!=='released')return {};
  return {release_status:record.release_status,
    ...(typeof record.release_date==='string'?{release_date:record.release_date}:{})};
}
export function igdbEssentialRecord(game,now=new Date()) {
  if(!Number.isSafeInteger(game?.id)||game.id<=0||typeof game.name!=='string'||!game.name.trim()
    ||typeof game.slug!=='string'||game.slug.length>200||!/^[a-z0-9]+(?:-+[a-z0-9]+)*$/.test(game.slug)) return null;
  if(['themes','platforms','genres','websites','screenshots','release_dates','involved_companies'].some(key=>game[key]!=null&&!Array.isArray(game[key]))
    ||['summary','storyline'].some(key=>game[key]!=null&&typeof game[key]!=='string')) return null;
  if(game.game_type!=null&&game.game_type!==0&&game.game_type?.id!==0) return null;
  const description=(game.storyline||game.summary||'').slice(0,8000);
  const tags=(game.themes||[]).map(item=>item.name).filter(value=>typeof value==='string');
  if(!isPublicContentAllowed({ title: game.name, tags, description })
    ||/\b(season pass|expansion pass|soundtrack|artbook|starter pack|bonus content|cosmetic pack)\b/i.test(game.name)) return null;
  const cover=image(game.cover?.image_id);
  const release=Number.isFinite(game.first_release_date)?new Date(game.first_release_date*1000):null;
  const rawReleaseDate=release&&Number.isFinite(release.getTime())?release.toISOString().slice(0,10):null;
  // IGDB first_release_date can encode a year/quarter/month placeholder.
  // Store a day only when a matching release has day-level precision.
  const normalized=value=>String(value||'').toLowerCase().replace(/[-_]/g,' ').trim();
  const day=now.toISOString().slice(0,10);
  const exactDates=(game.release_dates||[]).flatMap(item=>{
    if(!Number.isFinite(item?.date)||item?.date_format?.format!=='YYYYMMDD')return [];
    const date=new Date(item.date*1000);if(!Number.isFinite(date.getTime()))return [];
    return [{epoch:item.date,date:date.toISOString().slice(0,10),status:normalized(item.status?.name)}];
  });
  const fullDates=exactDates.filter(item=>item.status==='full release').sort((a,b)=>a.date.localeCompare(b.date));
  const pastFull=fullDates.find(item=>item.date<=day);
  const firstExact=exactDates.find(item=>item.epoch===game.first_release_date);
  const status=normalized(game.game_status?.status);
  // A game can omit current game_status while providing explicit platform
  // Full Release records. First-playable/Early Access dates alone prove neither.
  const releaseStatus=status.includes('early access')?'early_access':status==='cancelled'||status==='canceled'?'cancelled'
    :status==='delisted'?'delisted':status==='released'||!status&&pastFull?'released'
    :(fullDates[0]?.date||rawReleaseDate||'')>day?'upcoming':null;
  // Preserve a known full-release date when refreshing an already released
  // title whose only newly supplied date describes Early Access or a future port.
  const releaseDate=releaseStatus==='released'
    ?pastFull?.date||(firstExact&&firstExact.status!=='early access'&&firstExact.date<=day?firstExact.date:null)
    :fullDates[0]?.date||(firstExact&&(firstExact.status!=='early access'||firstExact.date>day||status.includes('early access'))?rawReleaseDate:null);
  let steamId=null;
  for(const site of game.websites||[]) {
    try {const url=new URL(site.url);const match=url.pathname.match(/^\/app\/([0-9]+)(?:\/|$)/);
      if(url.protocol==='https:'&&url.hostname==='store.steampowered.com'&&match&&Number.isSafeInteger(Number(match[1]))) steamId=Number(match[1]);
    } catch { /* Identity is never guessed from names or arbitrary hosts. */ }
  }
  const screenshots=(game.screenshots||[]).map(item=>image(item.image_id).replace('t_cover_big_2x','t_screenshot_big')).filter(Boolean).slice(0,8);
  return {slug:game.slug,title:game.name.trim().slice(0,300),cover_image:cover,header_image:screenshots[0]||cover,screenshots,
    platforms:[...new Set((game.platforms||[]).map(item=>platforms[item.name]).filter(Boolean))],
    genres:[...new Set((game.genres||[]).map(item=>genres[item.name]||item.name).filter(value=>typeof value==='string'))],
    tags,developer:game.involved_companies?.find(item=>item.developer)?.company?.name||'',
    publisher:game.involved_companies?.find(item=>item.publisher)?.company?.name||'',
    release_date:releaseDate,release_status:releaseStatus,description,
    igdb_id:game.id,igdb_url:'https://www.igdb.com/games/'+game.slug,igdb_summary:description,
    igdb_rating:Number.isFinite(game.aggregated_rating)?Math.round(game.aggregated_rating):null,
    steam_app_id:steamId,steam_url:steamId?'https://store.steampowered.com/app/'+steamId:null,
    last_enriched_at:now.toISOString(),enrichment_sources:['igdb'],media_source:cover?'igdb':null};
}
