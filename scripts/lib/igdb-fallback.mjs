import { igdbEssentialRecord } from '../../src/lib/external/igdb-record.mjs';
import { preferExistingCover, reviewedHeroArtwork, selectLandscapeArtwork } from '../../src/lib/utils/artwork-policy.mjs';
const fields='id,name,slug,summary,storyline,first_release_date,release_dates.date,release_dates.date_format.format,release_dates.status.name,updated_at,url,game_type,game_status.status,cover.image_id,screenshots.image_id,screenshots.width,screenshots.height,artworks.image_id,artworks.width,artworks.height,artworks.alpha_channel,artworks.animated,artworks.image_type.name,genres.name,themes.name,platforms.name,websites.url,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,aggregated_rating';
export async function readIgdbDiscovery(query) {
  const start=Math.floor(Date.now()/1000),end=start+3*366*86400;
  const games=await query('games','fields '+fields+'; where game_type = 0 & cover != null & first_release_date > '+start+' & first_release_date < '+end+'; sort hypes desc; limit 40;');
  if(!Array.isArray(games)||!games.length) throw new Error('Independent IGDB discovery unavailable; no successful progress claimed');
  return games;
}

export async function upsertIgdbEssential(sql,game,{allowCreate=false}={}) {
  const record=igdbEssentialRecord(game);if(!record) return {created:0,updated:0,skipped:1};
  return sql.begin(async tx=>{
    const matches=await tx`SELECT g.* FROM public.games g WHERE g.igdb_id=${record.igdb_id}
      OR g.id IN (SELECT game_id FROM public.game_sources WHERE source_name='igdb' AND source_game_id=${String(record.igdb_id)})
      OR (${record.steam_app_id}::bigint IS NOT NULL AND g.steam_app_id=${record.steam_app_id}) LIMIT 3 FOR UPDATE OF g`;
    if(matches.length>1) throw new Error('Ambiguous provider identity; manual catalogue review required');
    let gameId;let created=0;
    if(matches.length) {
      const existing=matches[0];
      if(existing.igdb_id&&existing.igdb_id!==record.igdb_id) throw new Error('Conflicting IGDB identity; existing mapping preserved');
      const cover=preferExistingCover(existing.cover_image,record.cover_image)?existing.cover_image:record.cover_image||existing.cover_image;
      const explicitCurrentStatus=Boolean(game.game_status?.status);
      const preserveStatus=!explicitCurrentStatus && (['released','cancelled','delisted'].includes(existing.release_status)
        || existing.release_status==='early_access'&&record.release_status!=='released');
      const preserveFullReleaseDate=existing.release_status==='released'&&!explicitCurrentStatus&&record.release_status!=='released';
      const update={igdb_id:record.igdb_id,igdb_url:record.igdb_url,igdb_summary:record.igdb_summary,
        igdb_rating:record.igdb_rating??existing.igdb_rating,
        steam_app_id:existing.steam_app_id||record.steam_app_id,steam_url:existing.steam_url||record.steam_url,
        platforms:[...new Set([...(existing.platforms||[]),...record.platforms])],
        genres:existing.genres?.length?existing.genres:record.genres,
        developer:existing.developer||record.developer,publisher:existing.publisher||record.publisher,
        description:!existing.description||existing.description===existing.igdb_summary?record.description||existing.description:existing.description,
        release_date:preserveFullReleaseDate?existing.release_date:record.release_date||existing.release_date,
        release_status:preserveStatus?existing.release_status:record.release_status||existing.release_status,
        cover_image:cover,media_source:cover===existing.cover_image?existing.media_source:record.media_source,
        header_image:selectLandscapeArtwork({
          igdb:game, cover:existing.cover_image, existing:existing.header_image, steamAppId:existing.steam_app_id,
          reviewed:reviewedHeroArtwork({ slug:existing.slug, igdbId:game.id, rawgId:existing.rawg_id }),
        }) || existing.header_image,
        screenshots:existing.screenshots?.length?existing.screenshots:record.screenshots,
        last_enriched_at:record.last_enriched_at,enrichment_sources:[...new Set([...(existing.enrichment_sources||[]),'igdb'])]};
      // Preserve identifiers, scores/reviews/interest, editorials and manual choices.
      await tx`UPDATE public.games SET ${tx(update)} WHERE id=${existing.id}`;
      gameId=existing.id;
    } else {
      if(!allowCreate||record.release_status!=='upcoming'||!record.cover_image||record.description.length<20
        ||!record.platforms.length||!record.genres.length) return {created:0,updated:0,skipped:1};
      const inserted=await tx`INSERT INTO public.games ${tx({...record,rawg_id:null,score:0,verdict_score:0,confidence:0,
        review_count:0,verdict_label:'COMING SOON',is_provisional:true,pros:[],cons:[],featured:false,trending:false,score_source:'pending'})}
        ON CONFLICT(slug) DO NOTHING RETURNING id`;
      if(!inserted.length) return {created:0,updated:0,skipped:1};
      gameId=inserted[0].id;created=1;
    }
    const mapping=await tx`INSERT INTO public.game_sources(game_id,source_name,source_game_id,source_url,raw_data)
      VALUES(${gameId},'igdb',${String(record.igdb_id)},${record.igdb_url},${tx.json(game)})
      ON CONFLICT(source_name,source_game_id) DO UPDATE SET source_url=excluded.source_url,raw_data=excluded.raw_data
      WHERE public.game_sources.game_id=excluded.game_id RETURNING game_id`;
    if(mapping.length!==1) throw new Error('Concurrent provider identity conflict; transaction rolled back');
    return {created,updated:created?0:1,skipped:0};
  });
}

export async function refreshIgdbCatalogue(sql,query,{limit=80}={}) {
  const upcoming=await readIgdbDiscovery(query);
  const known=await sql`SELECT igdb_id FROM public.games WHERE igdb_id IS NOT NULL AND
    (last_enriched_at IS NULL OR last_enriched_at<now()-interval '24 hours') ORDER BY last_enriched_at NULLS FIRST,id LIMIT 40`;
  let refreshed=[];
  if(known.length) {
    await new Promise(resolve=>setTimeout(resolve,300));
    refreshed=await query('games','fields '+fields+'; where id = ('+known.map(row=>row.igdb_id).filter(Number.isSafeInteger).join(',')+'); limit 40;');
    if(!Array.isArray(refreshed)) throw new Error('IGDB essential metadata refresh failed');
  }
  const unique=new Map([...upcoming,...refreshed].map(game=>[game.id,game]));
  const totals={created:0,updated:0,skipped:0,scanned:unique.size,provider:'igdb',rawgAvailable:false};
  for(const game of [...unique.values()].slice(0,limit)) {
    const result=await upsertIgdbEssential(sql,game,{allowCreate:true});
    for(const key of ['created','updated','skipped']) totals[key]+=result[key];
  }
  return totals;
}
