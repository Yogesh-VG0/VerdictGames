// Shared by the Next ingestion path and standalone maintenance process.
export function heroArtworkUrl(value) {
  try {
    const url=new URL(value);
    if(url.protocol==='https:' && url.hostname==='images.igdb.com')
      url.pathname=url.pathname.replace(/\/t_(?:screenshot_big|screenshot_med|720p)\//,'/t_1080p/');
    return url.href;
  }catch{return value;}
}

export function igdbLandscapeArtwork(game) {
  const candidates=(Array.isArray(game?.artworks)?game.artworks:[]).filter(art=>
    /^[a-zA-Z0-9_]{1,128}$/.test(art?.image_id||'') && Number.isFinite(art.width)
    && Number.isFinite(art.height) && art.width>=1280 && art.height>0 && art.width/art.height>=1.5);
  candidates.sort((a,b)=>b.width*b.height-a.width*a.height || a.image_id.localeCompare(b.image_id));
  return candidates.length?`https://images.igdb.com/igdb/image/upload/t_1080p/${candidates[0].image_id}.jpg`:null;
}

export function portraitPriority(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return 0;
    if (parsed.hostname === 'images.igdb.com' && /\/t_cover_/.test(parsed.pathname)) return 30;
    if (/(^|\.)(steamstatic\.com|akamaihd\.net)$/.test(parsed.hostname) && /library_600x900/.test(parsed.pathname)) return 20;
    return 10;
  } catch { return 0; }
}

export function preferExistingCover(existing, incoming) {
  return Boolean(existing) && portraitPriority(existing) >= portraitPriority(incoming);
}
