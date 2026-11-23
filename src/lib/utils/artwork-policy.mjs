// Shared by Next ingestion and the standalone maintenance workers.
const steamHosts = new Set([
  'cdn.akamai.steamstatic.com', 'cdn.cloudflare.steamstatic.com', 'shared.akamai.steamstatic.com',
  'shared.fastly.steamstatic.com', 'steamcdn-a.akamaihd.net',
]);
const igdbPath = /^\/igdb\/image\/upload\/t_(1080p|720p|screenshot_huge|screenshot_big|screenshot_med)\/([a-z0-9]+)\.(jpg|png|webp)$/i;
const rawgPath = /^\/media\/(?:resize\/\d+\/(?:-|\d+)\/)?(games|screenshots)\/(?:[\w-]+\/)*[\w-]+\.(jpg|jpeg|png|webp)$/i;
const reviewedArtwork = {
  'grand-theft-auto-vi': {
    igdbId: 52189, rawgId: 972995,
    url: 'https://images.igdb.com/igdb/image/upload/t_1080p/ar6i4p.jpg',
    fallbackUrl: 'https://images.igdb.com/igdb/image/upload/t_screenshot_big/scwpqj.jpg',
    mobileFocalPoint: 'right',
    credit: 'Rockstar Games promotional artwork via IGDB',
    sourceUrl: 'https://www.igdb.com/games/grand-theft-auto-vi',
  },
  // The wide promotional crop loses the jets on phones. The cockpit image
  // keeps the pilot and wing visible at all three reviewed widths.
  'ace-combat-8-wings-of-theve': {
    igdbId: 381247,
    url: 'https://images.igdb.com/igdb/image/upload/t_screenshot_huge/sc10tdu.jpg',
    fallbackUrl: 'https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc10tdv.jpg',
    credit: 'Bandai Namco Entertainment screenshot via IGDB',
    sourceUrl: 'https://www.igdb.com/games/ace-combat-8-wings-of-theve',
  },
  // The Steam hero embeds oversized title text across the caption. Keep the
  // clean chase scene after comparing the available source images in the hero.
  'schedule-i': {
    igdbId: 328373,
    url: 'https://images.igdb.com/igdb/image/upload/t_screenshot_huge/scv33x.jpg',
    fallbackUrl: 'https://images.igdb.com/igdb/image/upload/t_screenshot_big/scv33u.jpg',
    credit: 'TVGS screenshot via IGDB',
    sourceUrl: 'https://www.igdb.com/games/schedule-i',
  },
};

function imageUrl(value) {
  if (typeof value !== 'string' || value.length > 1024) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url : null;
  } catch { return null; }
}

export function reviewedHeroArtwork({ slug, igdbId, rawgId }) {
  if (!Object.hasOwn(reviewedArtwork, slug)) return null;
  const entry = reviewedArtwork[slug];
  return igdbId === entry.igdbId || (igdbId == null && entry.rawgId != null && rawgId === entry.rawgId) ? entry : null;
}

const titleKey = name => String(name ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');

export function matchedIgdbArtwork(game, { igdbId, steamAppId, title, releaseDate }) {
  if (!Number.isSafeInteger(game?.id) || game.id <= 0) return null;
  if (igdbId != null) return game.id === igdbId ? game : null;
  const key = titleKey(title);
  if (!key || titleKey(game.name) !== key) return null;
  const steamLinks = (Array.isArray(game.websites) ? game.websites : []).flatMap(site => {
    const url = imageUrl(site?.url);
    const id = url?.hostname === 'store.steampowered.com' && url.pathname.match(/^\/app\/(\d+)(?:\/|$)/)?.[1];
    return id ? [Number(id)] : [];
  });
  if (steamAppId && steamLinks.length) return steamLinks.includes(steamAppId) ? game : null;
  const referenceYear = Number(releaseDate?.slice(0, 4));
  const candidateYear = new Date(game.first_release_date * 1000).getUTCFullYear();
  return referenceYear > 0 && Math.abs(referenceYear - candidateYear) <= 1 ? game : null;
}

function igdbCandidates(game, kind) {
  const images = game?.[kind === 'artwork' ? 'artworks' : 'screenshots'];
  if (!Array.isArray(images)) return [];
  return images.flatMap(asset => {
    if (!/^[a-z0-9]{1,128}$/i.test(asset?.image_id ?? '') || asset.image_id === game.cover?.image_id
      || asset.animated || asset.alpha_channel || /\b(logo|icon|portrait)\b/i.test(asset.image_type?.name ?? '')) return [];
    const { width, height } = asset;
    const ratio = width / height;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1280 || height < 620
      || ratio < 1.55 || ratio > 2.65) return [];
    const desktop = width >= 1920 && height >= 1080;
    const variant = desktop ? (kind === 'artwork' ? '1080p' : 'screenshot_huge') : '720p';
    const strongArtwork = height >= 900 && ratio <= 2.15;
    return [{
      url: `https://images.igdb.com/igdb/image/upload/t_${variant}/${asset.image_id}.jpg`,
      tier: kind === 'artwork' ? (strongArtwork ? 100 : 80) : 60,
      // Prefer room for a responsive crop before capped resolution. Extra pixels
      // beyond the delivery limit provide no ranking advantage.
      fit: Math.round(Math.abs(Math.log(ratio / (16 / 9))) * 24),
      resolution: Math.min(width, 1920) * Math.min(height, 1080),
    }];
  });
}

function compareArtwork(a, b) {
  return b.tier - a.tier || a.fit - b.fit || b.resolution - a.resolution || a.url.localeCompare(b.url);
}

function steamPath(url, appId) {
  const match = url && steamHosts.has(url.hostname) && url.pathname.match(/^\/(?:steam\/apps|store_item_assets\/steam\/apps)\/(\d+)\/(?:[a-z0-9]+\/)?([^/]+)$/i);
  return match && (appId === undefined || Number(match[1]) === appId) ? match[2] : null;
}

const steamHero = /^library_hero(?:_2x)?\.(jpg|png|webp)$/i;
const steamScreenshot = /^ss_[a-z0-9]+\.(jpg|png|webp)$/i;

export function steamLibraryHeroAsset(item, appId) {
  const { asset_url_format, library_hero, library_hero_2x } = item?.assets ?? {};
  if (item?.appid !== appId || typeof asset_url_format !== 'string' || !asset_url_format.includes('${FILENAME}')) return null;
  const filename = library_hero || library_hero_2x;
  if (!steamHero.test(filename ?? '')) return null;
  const url = imageUrl(`https://shared.akamai.steamstatic.com/store_item_assets/${asset_url_format.replace('${FILENAME}', filename)}`);
  return url && steamHero.test(steamPath(url, appId) ?? '') ? url.href : null;
}

function storedTier(value, steamAppId) {
  const url = imageUrl(value);
  if (!url) return 0;
  if (url.hostname === 'images.igdb.com') {
    const variant = url.pathname.match(igdbPath)?.[1];
    // Existing 1080p headers were used for promotional artwork. Legacy
    // screenshots normally use screenshot_big. Preserve uncertain 720p assets.
    return variant === '1080p' ? 100 : variant === '720p' ? 80 : variant ? 60 : 0;
  }
  if (url.hostname === 'media.rawg.io') {
    const folder = url.pathname.match(rawgPath)?.[1];
    return folder === 'games' ? 70 : folder === 'screenshots' ? 40 : 0;
  }
  const steamFile = steamPath(url, steamAppId);
  return steamHero.test(steamFile ?? '') ? 90 : steamScreenshot.test(steamFile ?? '') ? 40 : 0;
}

export function isProviderHeroArtwork(value) {
  return storedTier(value) > 0;
}

export function selectLandscapeArtwork({ igdb, rawg, rawgScreenshots = [], steam, steamAppId, steamHeroUrl, existing, cover, reviewed }) {
  if (reviewed) return reviewed.url;
  const candidates = [...igdbCandidates(igdb, 'artwork'), ...igdbCandidates(igdb, 'screenshot')];
  const add = (value, tier, accepts, fit = 0) => {
    const url = imageUrl(value);
    if (url && accepts(url)) candidates.push({ url: url.href, tier, fit, resolution: 0 });
  };
  const rawgFolder = (url, folder) => url.hostname === 'media.rawg.io' && url.pathname.match(rawgPath)?.[1] === folder;
  // Prefer the additional background within the same RAWG game response.
  add(rawg?.background_image_additional, 70, url => rawgFolder(url, 'games'));
  add(rawg?.background_image, 70, url => rawgFolder(url, 'games'), 1);
  for (const value of rawgScreenshots) add(value, 40, url => rawgFolder(url, 'screenshots'));
  if (steamAppId && steam?.steam_appid === steamAppId && steam.type === 'game') {
    add(steamHeroUrl, 90, url => steamHero.test(steamPath(url, steamAppId) ?? ''));
    for (const shot of Array.isArray(steam.screenshots) ? steam.screenshots : []) {
      add(shot?.path_full, 40, url => steamScreenshot.test(steamPath(url, steamAppId) ?? ''));
    }
  }
  const candidatesByPreference = candidates.filter(candidate => candidate.url !== cover).sort(compareArtwork);
  const best = candidatesByPreference[0];
  if (!existing || existing === cover) return best?.url ?? existing ?? '';
  if (!best || best.url === existing) return existing;
  // Never replace an unclassified but intentionally stored header on a guess.
  const existingTier = storedTier(existing, steamAppId);
  const igdbIdFromUrl = value => {
    const url = imageUrl(value);
    return url?.hostname === 'images.igdb.com' ? url.pathname.match(igdbPath)?.[2] : null;
  };
  const existingIgdbId = igdbIdFromUrl(existing);
  const observed = existingIgdbId && candidatesByPreference.find(item => igdbIdFromUrl(item.url) === existingIgdbId);
  if (observed === best && existingTier <= best.tier && /\/t_screenshot_(med|big)\//.test(existing)) return best.url;
  const existingRank = observed || { tier: existingTier, fit: 0, resolution: Infinity, url: existing };
  return existingTier && compareArtwork(best, existingRank) < 0 && (observed || best.tier > existingTier) ? best.url : existing;
}

// One bounded CDN availability check only when existing metadata has no strong
// IGDB artwork or cached Steam hero. The store response verifies the app ID.
export async function verifiedSteamLibraryHero({ steam, steamAppId, steamHeroUrl, igdb, existing, reviewed }, fetchImage = fetch) {
  if (reviewed || !Number.isSafeInteger(steamAppId) || steamAppId <= 0 || steam?.steam_appid !== steamAppId
    || steam.type !== 'game' || storedTier(existing, steamAppId) >= 90
    || igdbCandidates(igdb, 'artwork').some(candidate => candidate.tier === 100)) return null;
  const url = steamHero.test(steamPath(imageUrl(steamHeroUrl), steamAppId) ?? '')
    ? steamHeroUrl : `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppId}/library_hero.jpg`;
  try {
    const response = await fetchImage(url, { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(3000) });
    return response.ok && /^image\/(jpeg|png|webp)(?:;|$)/i.test(response.headers.get('content-type') ?? '') ? url : null;
  } catch { return null; }
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
