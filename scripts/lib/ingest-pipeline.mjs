/**
 * VERDICT.GAMES — Portable Ingest Pipeline (Heroku)
 *
 * Self-contained game ingestion that runs entirely on Heroku with direct
 * DB access. No Vercel API calls needed.
 *
 * Exports:
 *   ingestGameDirect(sql, query, options) — ingest a single game
 *   reEnrichBatch(sql, options)           — find stale games + re-ingest
 *   slugify(text)                         — URL-safe slug
 */

// ══════════════════════════════════════════════════
// Configuration
// ══════════════════════════════════════════════════
const RAWG_BASE = "https://api.rawg.io/api";
const STEAM_STORE_BASE = "https://store.steampowered.com/api";
const STEAM_API_BASE = "https://api.steampowered.com";
const IGDB_BASE = "https://api.igdb.com/v4";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const CHEAPSHARK_BASE = "https://www.cheapshark.com/api/1.0";
const WIKI_BASE = "https://en.wikipedia.org/api/rest_v1";

// ══════════════════════════════════════════════════
// Media Validation & Cover Image Strategy
// ══════════════════════════════════════════════════
// GLOBAL COVER PRIORITY ORDER:
//   1. IGDB cover (most reliable, high-quality)
//   2. RAWG background_image (good fallback)
//   3. Steam validated cover (last resort, unreliable)
//   4. Keep existing trusted media or leave empty for repair
// ══════════════════════════════════════════════════

/**
 * Known-good image URL patterns (trusted sources that rarely 404).
 * IGDB and RAWG are preferred over Steam.
 */
const TRUSTED_IMAGE_PATTERNS = [
  /images\.igdb\.com/,      // IGDB - highest priority
  /media\.rawg\.io/,        // RAWG - second priority
  /upload\.wikimedia\.org/, // Wikipedia - trusted
];

/** Media source priority ranking (lower = better) */
const MEDIA_SOURCE_PRIORITY = { igdb: 1, rawg: 2, steam: 3, unknown: 99 };

/**
 * Check if an image URL is from a trusted source.
 */
function isTrustedImageUrl(url) {
  if (!url) return false;
  return TRUSTED_IMAGE_PATTERNS.some(p => p.test(url));
}

/**
 * Get media source from URL.
 */
function getMediaSourceFromUrl(url) {
  if (!url) return null;
  if (/images\.igdb\.com/.test(url)) return "igdb";
  if (/media\.rawg\.io/.test(url)) return "rawg";
  if (/steamstatic\.com|steamcdn/.test(url)) return "steam";
  return "unknown";
}

/**
 * Check if new media source is better than existing.
 * Returns true if newSource should replace existingSource.
 */
function isMediaUpgrade(existingSource, newSource) {
  const existingPriority = MEDIA_SOURCE_PRIORITY[existingSource] ?? 99;
  const newPriority = MEDIA_SOURCE_PRIORITY[newSource] ?? 99;
  return newPriority < existingPriority;
}

/**
 * Fetch Steam cover via GetItems API (reliable fallback).
 * Returns { coverUrl, headerUrl } or null if not found.
 * Uses IStoreBrowseService/GetItems/v1 which returns proper asset paths.
 */
async function fetchSteamCoverViaGetItems(steamAppId) {
  if (!steamAppId) return null;
  try {
    const inputJson = JSON.stringify({
      ids: [{ appid: steamAppId }],
      context: { country_code: "US" },
      data_request: { include_assets: true }
    });
    const url = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(inputJson)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.response?.store_items?.[0];
    if (!item?.assets) return null;
    
    const { asset_url_format, library_capsule_2x, header } = item.assets;
    if (!asset_url_format || !library_capsule_2x) return null;
    
    // Build full URL: https://shared.akamai.steamstatic.com/store_item_assets/{asset_url_format with FILENAME replaced}
    const baseUrl = "https://shared.akamai.steamstatic.com/store_item_assets";
    const coverUrl = `${baseUrl}/${asset_url_format.replace("${FILENAME}", library_capsule_2x)}`;
    const headerUrl = header ? `${baseUrl}/${asset_url_format.replace("${FILENAME}", header)}` : null;
    
    return { coverUrl, headerUrl };
  } catch {
    return null;
  }
}

/**
 * Validate a Steam library cover URL via HEAD request.
 * First tries the standard CDN URL, then falls back to GetItems API.
 * Returns { url, source: 'steam' } if valid, null if not.
 */
async function validateAndGetSteamCover(steamAppId) {
  if (!steamAppId) return null;
  
  // Try standard CDN URL first (faster if it exists)
  const cdnUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppId}/library_600x900_2x.jpg`;
  try {
    const res = await fetch(cdnUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      return { coverUrl: cdnUrl, headerUrl: null, source: "steam-cdn" };
    }
  } catch { /* continue to fallback */ }
  
  // Fallback: Use GetItems API for games with non-standard asset paths
  const getItemsResult = await fetchSteamCoverViaGetItems(steamAppId);
  if (getItemsResult?.coverUrl) {
    return { ...getItemsResult, source: "steam-api" };
  }
  
  return null;
}

function getRawgKey() {
  const k = process.env.RAWG_API_KEY;
  if (!k) throw new Error("Missing RAWG_API_KEY");
  return k;
}

// ══════════════════════════════════════════════════
// Slug & Scoring Utilities
// ══════════════════════════════════════════════════
export function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, "-").replace(/&/g, "-and-")
    .replace(/[^\w-]+/g, "").replace(/--+/g, "-")
    .replace(/^-+/, "").replace(/-+$/, "");
}

function wilsonLB(pos, tot, z = 1.96) {
  if (tot === 0) return 0;
  const p = pos / tot, zz = z * z;
  return Math.max(0, (p + zz / (2 * tot) - z * Math.sqrt((p * (1 - p) + zz / (4 * tot)) / tot)) / (1 + zz / tot));
}
function communityScore(pos, tot) { return tot === 0 ? 0 : Math.round(wilsonLB(pos, tot) * 100); }
function criticScore(igdb, mc) {
  const s = []; if (igdb > 0) s.push(igdb); if (mc > 0) s.push(mc);
  return s.length ? { score: Math.round(s.reduce((a, b) => a + b) / s.length), n: s.length } : { score: null, n: 0 };
}
function confidence(revCnt, criticN, hasSteam) {
  const rc = revCnt <= 0 ? 0 : Math.min(0.65, (Math.log10(revCnt) / Math.log10(10000)) * 0.65);
  let sc = 0; if (hasSteam) sc += 0.15; if (criticN >= 1) sc += 0.12; if (criticN >= 2) sc += 0.08;
  return Math.min(1, rc + sc);
}
function verdictScore(comm, crit, conf) {
  const hC = comm != null && comm > 0, hR = crit != null && crit > 0;
  if (hC && hR) { const cw = 0.55 + conf * 0.10; return Math.round(comm * cw + crit * (1 - cw)); }
  if (hC) { const d = 0.80 + conf * 0.20; return Math.round(comm * d + 70 * (1 - d)); }
  if (hR) return Math.round(crit * 0.95 + 70 * 0.05);
  return 0;
}
function verdictLabel(vs, conf, upcoming, justRel) {
  if (upcoming) return "COMING SOON"; if (justRel) return "JUST RELEASED"; if (vs <= 0) return "COMING SOON";
  if (conf < 0.30) return vs >= 75 ? "WORTH IT" : vs >= 50 ? "MIXED" : "SKIP";
  if (conf < 0.50) return vs >= 90 ? "MUST PLAY" : vs >= 72 ? "WORTH IT" : vs >= 50 ? "MIXED" : "SKIP";
  return vs >= 88 ? "MUST PLAY" : vs >= 72 ? "WORTH IT" : vs >= 50 ? "MIXED" : "SKIP";
}
function legacyVerdict(s) { return s >= 90 ? "MUST PLAY" : s >= 75 ? "WORTH IT" : s >= 50 ? "MIXED" : "SKIP"; }
function rawgRatio(rating, count) {
  const r = Math.max(0, Math.min(1, (rating - 1) / 4));
  return { positive: Math.round(r * count), total: count };
}

// ══════════════════════════════════════════════════
// RAWG API
// ══════════════════════════════════════════════════
async function searchRawg(query) {
  const p = new URLSearchParams({ key: getRawgKey(), search: query, page: "1", page_size: "10", search_precise: "true" });
  const r = await fetch(`${RAWG_BASE}/games?${p}`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`RAWG search ${r.status}`); return r.json();
}
async function getRawgGame(id) {
  const r = await fetch(`${RAWG_BASE}/games/${id}?key=${getRawgKey()}`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`RAWG game ${r.status}`); return r.json();
}
async function getRawgScreenshots(id) {
  const r = await fetch(`${RAWG_BASE}/games/${id}/screenshots?key=${getRawgKey()}&page_size=10`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`RAWG screenshots ${r.status}`); return (await r.json()).results;
}
async function getRawgStoreLinks(id) {
  try { const r = await fetch(`${RAWG_BASE}/games/${id}/stores?key=${getRawgKey()}`, { signal: AbortSignal.timeout(15000) }); if (!r.ok) return []; return (await r.json()).results ?? []; } catch { return []; }
}
function extractSteamAppId(stores, links) {
  if (links?.length) { const sl = links.find(s => s.store_id === 1); if (sl?.url) { const m = sl.url.match(/store\.steampowered\.com\/app\/(\d+)/); if (m) return +m[1]; } }
  if (!stores) return null; const ss = stores.find(s => s.store?.slug === "steam" || s.store?.name?.toLowerCase() === "steam");
  if (!ss?.url) return null; const m = ss.url.match(/store\.steampowered\.com\/app\/(\d+)/); return m ? +m[1] : null;
}
function extractPlayStoreUrl(stores, links) {
  if (links?.length) { const pl = links.find(s => s.store_id === 8); if (pl?.url) return pl.url; }
  if (!stores) return null; const ps = stores.find(s => s.store?.slug === "google-play" || s.store?.name?.toLowerCase().includes("google play"));
  return ps?.url ?? null;
}
function mapPlatforms(plats) {
  if (!plats) return []; const m = [], add = p => { if (!m.includes(p)) m.push(p); };
  for (const { platform: pl } of plats) { const s = pl.slug.toLowerCase(), n = pl.name.toLowerCase();
    if (s === "pc") add("PC"); else if (s === "linux") add("Linux"); else if (s === "macos" || s === "macintosh") add("macOS");
    else if (s === "playstation5" || n.includes("playstation 5")) add("PlayStation 5");
    else if (s === "playstation4" || n.includes("playstation 4")) add("PlayStation 4");
    else if (s === "xbox-series-x" || n.includes("xbox series")) add("Xbox Series X|S");
    else if (s === "xbox-one" || n.includes("xbox one")) add("Xbox One");
    else if (s === "nintendo-switch" || n.includes("nintendo switch")) add("Nintendo Switch");
    else if (s === "android") add("Android"); else if (s === "ios") add("iOS");
  } return m;
}

// ══════════════════════════════════════════════════
// Steam API
// ══════════════════════════════════════════════════
async function getSteamReviews(appId) {
  try { const r = await fetch(`https://store.steampowered.com/appreviews/${appId}?json=1&language=all&purchase_type=all&num_per_page=0`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null; const d = await r.json(); return d.success === 1 ? d.query_summary : null; } catch { return null; }
}
async function getSteamDetails(appId) {
  try { const r = await fetch(`${STEAM_STORE_BASE}/appdetails?appids=${appId}&cc=us&l=english`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null; const d = await r.json(); const e = d[String(appId)]; return e?.success ? e.data : null; } catch { return null; }
}
async function getSteamPlayers(appId) {
  try { const r = await fetch(`${STEAM_API_BASE}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appId}`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null; const d = await r.json(); return d.response?.result === 1 ? d.response.player_count : null; } catch { return null; }
}
function steamPrice(d) {
  if (!d) return { cur: null, currency: "USD", free: false };
  if (d.is_free) return { cur: 0, currency: "USD", free: true };
  if (d.price_overview) return { cur: d.price_overview.final, currency: d.price_overview.currency, free: false };
  return { cur: null, currency: "USD", free: false };
}

// ══════════════════════════════════════════════════
// IGDB API
// ══════════════════════════════════════════════════
let _igdbToken = null;
async function igdbToken() {
  const cid = process.env.TWITCH_CLIENT_ID, cs = process.env.TWITCH_CLIENT_SECRET;
  if (!cid || !cs) return null;
  if (_igdbToken && Date.now() < _igdbToken.exp - 300000) return _igdbToken.tok;
  try { const r = await fetch(TWITCH_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cid, client_secret: cs, grant_type: "client_credentials" }) });
    if (!r.ok) return null; const d = await r.json(); _igdbToken = { tok: d.access_token, exp: Date.now() + d.expires_in * 1000 }; return _igdbToken.tok;
  } catch { return null; }
}
async function igdbQ(endpoint, body) {
  const tok = await igdbToken(); if (!tok) return null;
  try { const r = await fetch(`${IGDB_BASE}/${endpoint}`, { method: "POST",
    headers: { "Client-ID": process.env.TWITCH_CLIENT_ID, Authorization: `Bearer ${tok}`, "Content-Type": "text/plain" },
    body, signal: AbortSignal.timeout(15000) }); if (!r.ok) return null; return r.json(); } catch { return null; }
}
function igdbConfigured() { return !!(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET); }
function esc(s) { return s.replace(/"/g, '\\"'); }
function igdbImg(id, sz = "cover_big") { return `https://images.igdb.com/igdb/image/upload/t_${sz}/${id}.jpg`; }

const TRAILER_KW = ["official trailer","launch trailer","announcement trailer","reveal trailer","gameplay trailer","cinematic trailer","trailer","official"];
function pickTrailer(vids, name) {
  if (!vids?.length) return null;
  const gw = name.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
  let bs = -1, bv = null;
  for (const v of vids) { const vn = (v.name ?? "").toLowerCase(); let s = 0;
    for (let i = 0; i < TRAILER_KW.length; i++) if (vn.includes(TRAILER_KW[i])) { s += (TRAILER_KW.length - i) * 10; break; }
    s += gw.filter(w => w.length > 2 && vn.includes(w)).length * 5;
    if (s > bs) { bs = s; bv = v; } }
  if (bs <= 0) return vids.length === 1 ? vids[0] : null; return bv;
}
const IGDB_WEB = { OFFICIAL: 1, WIKIPEDIA: 3, REDDIT: 14 };

async function findIgdb(title, year) {
  const q = `search "${esc(title)}"; fields name,slug,summary,storyline,aggregated_rating,rating,total_rating,first_release_date,url,cover.image_id,screenshots.image_id,genres.name,platforms.name,videos.video_id,videos.name,websites.url,websites.category; where game_type = 0; limit 10;`;
  const res = await igdbQ("games", q); if (!res?.length) return null;
  const nt = title.toLowerCase().trim(); let bm = res[0], bs = -Infinity;
  for (const g of res) { let s = 0; const gn = g.name.toLowerCase().trim();
    if (gn === nt) s += 100; else if (gn.includes(nt) || nt.includes(gn)) s += 50;
    if (year && g.first_release_date) { const gy = new Date(g.first_release_date * 1000).getFullYear();
      if (gy === year) s += 80; else if (Math.abs(gy - year) === 1) s += 30; else if (Math.abs(gy - year) > 5) s -= 40; }
    if (g.cover?.image_id) s += 10; if (g.screenshots?.length) s += 5;
    if (s > bs) { bs = s; bm = g; } }
  // Follow-up full query for properly expanded nested fields
  const full = await igdbQ("games", `where id = ${bm.id}; fields name,slug,summary,storyline,aggregated_rating,aggregated_rating_count,rating,rating_count,total_rating,total_rating_count,first_release_date,url,cover.image_id,screenshots.image_id,genres.name,themes.name,platforms.name,platforms.abbreviation,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,videos.video_id,videos.name,websites.url,websites.category,similar_games.name,similar_games.slug,similar_games.cover.image_id,game_modes.name,player_perspectives.name; limit 1;`);
  return full?.[0] ?? bm;
}
function igdbEnrich(g) {
  let tUrl = null, tThumb = null;
  if (g.videos?.length) { const bv = pickTrailer(g.videos, g.name);
    if (bv) { tUrl = `https://www.youtube.com/watch?v=${bv.video_id}`; tThumb = `https://img.youtube.com/vi/${bv.video_id}/hqdefault.jpg`; } }
  let wikiUrl = null, webUrl = null, redditUrl = null;
  for (const s of g.websites ?? []) { if (s.category === IGDB_WEB.WIKIPEDIA) wikiUrl = s.url; else if (s.category === IGDB_WEB.OFFICIAL) webUrl = s.url; else if (s.category === IGDB_WEB.REDDIT) redditUrl = s.url; }
  return { igdbId: g.id, igdbUrl: g.url ?? null, igdbRating: g.aggregated_rating ? Math.round(g.aggregated_rating) : null,
    igdbSummary: g.storyline || g.summary || null, trailerUrl: tUrl, trailerThumbnail: tThumb,
    wikipediaUrl: wikiUrl, websiteUrl: webUrl, redditUrl: redditUrl,
    coverUrl: g.cover?.image_id ? igdbImg(g.cover.image_id, "cover_big_2x") : null,
    screenshots: (g.screenshots ?? []).slice(0, 6).map(s => igdbImg(s.image_id, "screenshot_big")) };
}

// ══════════════════════════════════════════════════
// CheapShark API
// ══════════════════════════════════════════════════
function cents(p) { return Math.round(parseFloat(p) * 100); }
async function csSearch(title, lim = 5) {
  try { const r = await fetch(`${CHEAPSHARK_BASE}/games?title=${encodeURIComponent(title)}&limit=${lim}&exact=0`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return []; return await r.json() ?? []; } catch { return []; }
}
async function csGame(id) {
  try { const r = await fetch(`${CHEAPSHARK_BASE}/games?id=${id}`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null; return r.json(); } catch { return null; }
}
async function csDeals(steamAppId) {
  try { const r = await fetch(`${CHEAPSHARK_BASE}/deals?steamAppID=${steamAppId}&pageSize=5&sortBy=Deal+Rating`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return []; return await r.json() ?? []; } catch { return []; }
}
async function findDeal(title, steamAppId) {
  try {
    if (steamAppId) { const deals = await csDeals(steamAppId);
      if (deals.length) { const d = deals[0]; const sr = await csSearch(title, 1); const csId = sr[0]?.gameID ?? d.gameID;
        let low = null; if (csId) { const gi = await csGame(csId); if (gi?.cheapestPriceEver) low = cents(gi.cheapestPriceEver.price); }
        return { csId, cur: cents(d.salePrice), low, dealUrl: `https://www.cheapshark.com/redirect?dealID=${d.dealID}`, free: d.salePrice === "0.00" }; } }
    const sr = await csSearch(title, 3); if (!sr.length) return null;
    let best = sr[0]; if (steamAppId) { const sm = sr.find(r => r.steamAppID === String(steamAppId)); if (sm) best = sm; }
    const gi = await csGame(best.gameID); const low = gi?.cheapestPriceEver ? cents(gi.cheapestPriceEver.price) : null;
    return { csId: best.gameID, cur: cents(best.cheapest), low,
      dealUrl: best.cheapestDealID ? `https://www.cheapshark.com/redirect?dealID=${best.cheapestDealID}` : null, free: best.cheapest === "0.00" };
  } catch { return null; }
}

// ══════════════════════════════════════════════════
// Wikipedia API
// ══════════════════════════════════════════════════
const ANTI_KW = ["operating system","software","kernel","mit","research","university","programming language","framework","library","algorithm","protocol","file system","database","compiler","browser","application software"];
const GAME_KW = ["video game","gameplay","player","release","console","playstation","xbox","nintendo","steam","pc game","developed by","published by"];
function validGameWiki(a, gt) {
  const t = (a.title + " " + a.extract).toLowerCase(); const gn = gt.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (ANTI_KW.some(k => t.includes(k))) return false; if (!GAME_KW.some(k => t.includes(k))) return false;
  const tn = a.title.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (a.title.toLowerCase().includes("(operating system)") || a.title.toLowerCase().includes("(os)")) return false;
  if (gn.length >= 4 && !tn.includes(gn) && !gn.includes(tn.slice(0, 6))) return false; return true;
}
async function wikiSummary(title) {
  try { const r = await fetch(`${WIKI_BASE}/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    { headers: { "User-Agent": "VerdictGames/1.0 (https://verdict.games)" }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null; const d = await r.json(); return d.type === "disambiguation" ? null : d; } catch { return null; }
}
async function findWiki(gt) {
  for (const v of [`${gt} (video game)`, gt, `${gt} (game)`]) {
    const s = await wikiSummary(v);
    if (s?.extract && validGameWiki(s, gt)) { let ex = s.extract;
      if (ex.length > 1200) { const c = ex.substring(0, 1200); const lp = c.lastIndexOf("."); ex = lp > 400 ? c.substring(0, lp + 1) : c.trimEnd() + "..."; }
      return { excerpt: ex, url: s.content_urls.desktop.page }; } } return null;
}

// ══════════════════════════════════════════════════
// HLTB API
// ══════════════════════════════════════════════════
async function fetchHLTB(gt) {
  try { const r = await fetch("https://howlongtobeat.com/api/search", { method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "verdict.games/1.0", Referer: "https://howlongtobeat.com" },
    body: JSON.stringify({ searchType: "games", searchTerms: gt.split(" "), searchPage: 1, size: 5,
      searchOptions: { games: { userId: 0, platform: "", sortCategory: "popular", rangeCategory: "main", rangeTime: { min: null, max: null },
        gameplay: { perspective: "", flow: "", genre: "" }, rangeYear: { min: "", max: "" }, modifier: "" },
        users: { sortCategory: "postcount" }, filter: "", sort: 0, randomizer: 0 } }),
    signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null; const j = await r.json(); const gs = j?.data; if (!gs?.length) return null;
    const n = gt.toLowerCase().trim(); const m = gs.find(g => g.game_name?.toLowerCase().trim() === n) ?? gs[0];
    const rnd = v => v ? Math.round(v * 10) / 10 : null;
    return { main: rnd(m.comp_main ? m.comp_main / 3600 : null), extras: rnd(m.comp_plus ? m.comp_plus / 3600 : null),
      completionist: rnd(m.comp_100 ? m.comp_100 / 3600 : null) };
  } catch { return null; }
}

// ══════════════════════════════════════════════════
// Ingest Helpers
// ══════════════════════════════════════════════════
function stripHtml(h) { return h.replace(/<[^>]*>/g, "").trim(); }

function buildDesc(rawg, igdb, wiki) {
  if (wiki?.excerpt?.length > 80) return wiki.excerpt;
  const is = igdb?.summary || igdb?.storyline || "";
  if (is.length > 80) { if (is.length > 1200) { const c = is.substring(0, 1200); const lp = c.lastIndexOf("."); return lp > 400 ? c.substring(0, lp + 1) : c.trimEnd() + "..."; } return is; }
  const rd = rawg.description_raw || stripHtml(rawg.description || ""); if (!rd) return "";
  if (rd.length > 1200) { const c = rd.substring(0, 1200); const lp = c.lastIndexOf("."); return lp > 400 ? c.substring(0, lp + 1) : c.trimEnd() + "..."; }
  return rd;
}

function genSummary(title, score, genres) {
  const gs = genres.slice(0, 2).join("/") || "game", g1 = genres[0]?.toLowerCase() ?? "game";
  const v = title.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 4;
  if (score >= 90) return [`${title} is an exceptional ${gs} that raises the bar for the genre.`,`A masterclass in ${g1} design, ${title} delivers an unforgettable experience from start to finish.`,`${title} stands out as one of the best ${gs} titles in recent memory.`,`With near-perfect execution, ${title} is a must-play for any ${g1} fan.`][v];
  if (score >= 75) return [`${title} is a strong ${gs} that delivers where it counts.`,`A well-crafted ${g1} experience, ${title} is well worth your time.`,`${title} confidently hits its marks as a quality ${gs} title.`,`Fans of the ${g1} genre will find plenty to enjoy in ${title}.`][v];
  if (score >= 50) return [`${title} has interesting ideas but inconsistent execution holds it back.`,`A mixed bag, ${title} shows flashes of brilliance alongside notable shortcomings.`,`${title} offers a decent ${gs} experience but doesn't quite reach its potential.`,`There's fun to be had in ${title}, though it may not appeal to everyone.`][v];
  return [`${title} struggles to deliver on its ${gs} ambitions.`,`Despite some effort, ${title} falls short of expectations in key areas.`,`${title} has fundamental issues that make it difficult to recommend.`,`Only for the most dedicated ${g1} fans — ${title} needs significant improvements.`][v];
}

function genPros(game, sr, igdb, players) {
  const pros = [];
  if (sr) { const pct = Math.round((sr.total_positive / sr.total_reviews) * 100);
    if (pct >= 90) { const t = sr.total_reviews; const cs = t >= 1000 ? `${(t/1000).toFixed(t>=10000?0:1)}K` : String(t);
      pros.push(`${sr.review_score_desc} on Steam (${pct}% positive from ${cs} reviews)`);
    } else if (pct >= 75) pros.push(`${sr.review_score_desc} Steam reviews (${pct}% positive)`); }
  if (players > 5000) pros.push(`Active community with ${players.toLocaleString()} concurrent players`);
  else if (players > 500) pros.push(`Healthy player count of ${players.toLocaleString()} concurrent`);
  if (igdb?.aggregated_rating >= 80) pros.push(`Critically acclaimed (${Math.round(igdb.aggregated_rating)}/100 critic average)`);
  const tags = (game.tags ?? []).map(t => t.name.toLowerCase());
  if (tags.includes("story rich") || tags.includes("narrative")) pros.push("Compelling narrative and story");
  if (tags.includes("open world") || tags.includes("exploration")) pros.push("Rich open world to explore");
  if (tags.includes("multiplayer") || tags.includes("co-op")) pros.push("Engaging multiplayer/co-op experience");
  if (tags.includes("great soundtrack") || tags.includes("soundtrack")) pros.push("Outstanding soundtrack");
  if ((game.genres ?? []).map(g => g.name.toLowerCase()).includes("indie") && game.rating >= 4) pros.push("Standout indie gem");
  if (pros.length < 2 && game.rating >= 4) pros.push(`Highly rated by ${(game.ratings_count ?? 0).toLocaleString()} players`);
  if (!pros.length) pros.push("Unique gameplay concept");
  return pros.slice(0, 4);
}

function genCons(game, sr, igdb) {
  const cons = [], tags = (game.tags ?? []).map(t => t.name.toLowerCase());
  if (sr) { const pct = Math.round((sr.total_positive / sr.total_reviews) * 100); if (pct < 70) cons.push(`Mixed Steam reception (${pct}% positive)`); }
  if (tags.includes("difficult") || tags.includes("souls-like")) cons.push("Steep difficulty curve may not appeal to casual players");
  if (tags.includes("early access")) cons.push("Still in Early Access — content may be incomplete");
  if (tags.includes("microtransactions") || tags.includes("in-app purchases")) cons.push("Contains microtransactions");
  if (tags.includes("grinding") || tags.includes("grindy")) cons.push("Can require significant grinding");
  if (game.rating < 3.5 && (game.ratings_count ?? 0) > 100) cons.push("Below-average player reception");
  if (!cons.length) { if (!game.metacritic && !igdb?.aggregated_rating) cons.push("Limited professional critic coverage"); else cons.push("No significant drawbacks reported"); }
  return cons.slice(0, 3);
}

const BLOCKED = new Set(["grand-theft-aito-vi"]);

// ══════════════════════════════════════════════════
// Main Ingest Function (Direct DB)
// ══════════════════════════════════════════════════
/**
 * Ingest a game by title, using direct DB access.
 * @param {import('postgres').Sql} sql - postgres connection
 * @param {string} query - game title to search
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh] - re-enrich even if exists
 * @param {string}  [options.expectedSlug] - hint for best-match selection
 * @returns {Promise<{success:boolean, gameId:string|null, slug:string|null, message:string, alreadyExisted:boolean}>}
 */
export async function ingestGameDirect(sql, query, options = {}) {
  const { forceRefresh = false, expectedSlug } = options;

  // ── 1. Search RAWG ──
  const search = await searchRawg(query);
  if (!search.results?.length) return { success: false, gameId: null, slug: null, message: `No RAWG results for "${query}".`, alreadyExisted: false };

  // ── 2. Pick best match ──
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const tok = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  const trailingNum = s => { const m = s.toLowerCase().replace(/[^a-z0-9-]/g, "").match(/[-]?(vi{0,3}|iv|ix|[0-9]+)$/); return m ? m[1] : null; };
  const overlap = (qt, rt) => { const rs = new Set(tok(rt)); return qt.length ? qt.filter(t => rs.has(t)).length / qt.length : 0; };
  const qn = norm(query), qt = tok(query), en = expectedSlug ? norm(expectedSlug) : qn;
  const eNum = expectedSlug ? trailingNum(expectedSlug) : trailingNum(query);

  const sc = r => {
    let s = (r.released ? 1 : 0) + (r.rating ? 1 : 0) + Math.min((r.ratings_count ?? 0) / 5000, 3);
    const rs = norm(r.slug ?? r.name), rn = norm(r.name);
    if (rs === en) s += 100; else if (rn === en) s += 90;
    else if (rn.startsWith(en) || en.startsWith(rn)) s += 60;
    else s += Math.round(overlap(qt, r.name) * 50);
    if (eNum) { const rNum = trailingNum(r.slug ?? r.name); if (rNum !== eNum) s -= 200; }
    return s;
  };
  const best = search.results.reduce((b, c) => sc(c) > sc(b) ? c : b, search.results[0]);
  if (sc(best) < 30) return { success: false, gameId: null, slug: null, message: `No confident match for "${query}".`, alreadyExisted: false };

  const slug = slugify(best.name);
  if (BLOCKED.has(slug)) return { success: false, gameId: null, slug: null, message: `"${slug}" is blocklisted.`, alreadyExisted: false };

  // ── 3. Check existence ──
  const [existing] = await sql`SELECT id, slug FROM games WHERE slug = ${slug} OR rawg_id = ${best.id} LIMIT 1`;
  if (existing && !forceRefresh) return { success: true, gameId: existing.id, slug: existing.slug, message: "Already exists.", alreadyExisted: true };

  // ── 4. Fetch full details ──
  const [fullGame, screenshots, storeLinks] = await Promise.all([
    getRawgGame(best.id), getRawgScreenshots(best.id), getRawgStoreLinks(best.id),
  ]);

  // ── 5. Enrich from multiple sources ──
  const steamAppId = extractSteamAppId(fullGame.stores, storeLinks);
  const playStoreUrl = extractPlayStoreUrl(fullGame.stores, storeLinks);
  const releaseYear = fullGame.released ? new Date(fullGame.released).getFullYear() : undefined;
  const sources = ["rawg"];

  const [steamRev, steamDet, steamPl, csData, igdbData, wikiData, hltbData] = await Promise.all([
    steamAppId ? getSteamReviews(steamAppId) : null,
    steamAppId ? getSteamDetails(steamAppId) : null,
    steamAppId ? getSteamPlayers(steamAppId) : null,
    findDeal(fullGame.name, steamAppId).catch(() => null),
    igdbConfigured() ? findIgdb(fullGame.name, releaseYear).catch(e => { console.warn("[ingest] IGDB failed:", e.message); return null; }) : null,
    findWiki(fullGame.name).catch(() => null),
    fetchHLTB(fullGame.name).catch(() => null),
  ]);

  // ── Process Steam ──
  let sScore = null, sRevCount = 0;
  if (steamRev) { sScore = steamRev.total_reviews > 0 ? Math.round((steamRev.total_positive / steamRev.total_reviews) * 100) : null; sRevCount = steamRev.total_reviews; sources.push("steam"); }
  const sp = steamDet ? steamPrice(steamDet) : null;
  const curPlayers = steamPl ?? null;
  const allTags = [...(fullGame.tags ?? []).map(t => t.name.toLowerCase()), ...(fullGame.genres ?? []).map(g => g.name.toLowerCase())];
  const hasFreeTag = allTags.some(t => ["free-to-play","free to play","f2p"].includes(t));

  // ── Process CheapShark ──
  let csId = null, pCur = sp?.cur ?? null, pCurr = sp?.currency ?? "USD", pLow = null, pDealUrl = null, isFree = sp?.free ?? hasFreeTag;
  if (hasFreeTag) { isFree = true; pCur = 0; }
  if (csData) { csId = csData.csId;
    if (csData.cur !== null && (pCur === null || csData.cur < pCur)) pCur = csData.cur;
    pLow = csData.low; pDealUrl = csData.dealUrl; if (csData.free) isFree = true; sources.push("cheapshark"); }

  // ── Process IGDB ──
  let ie = null;
  if (igdbData) { ie = igdbEnrich(igdbData); sources.push("igdb"); }
  if (hltbData) sources.push("hltb");

  // ── Wikipedia ──
  let wikiUrl = ie?.wikipediaUrl ?? null, wikiExcerpt = null;
  if (wikiData) { wikiExcerpt = wikiData.excerpt; wikiUrl = wikiData.url; sources.push("wikipedia"); }

  // ── Compute scores ──
  let scoreSrc = "blended";
  const legacy = (() => {
    if (sScore !== null) { scoreSrc = "steam"; return sScore; }
    if (ie?.igdbRating) { scoreSrc = "igdb"; return ie.igdbRating; }
    if (fullGame.metacritic) { scoreSrc = "metacritic"; return fullGame.metacritic; }
    scoreSrc = "rawg"; return Math.round((fullGame.rating || 3) * 20);
  })();

  const sPos = steamRev?.total_positive ?? null, sTot = steamRev?.total_reviews ?? null;
  let commScore = null;
  if (sPos != null && sTot > 0) commScore = communityScore(sPos, sTot);
  else if (fullGame.rating && fullGame.ratings_count > 0) { const { positive, total } = rawgRatio(fullGame.rating, fullGame.ratings_count); commScore = communityScore(positive, total); }
  const { score: critScore, n: critN } = criticScore(ie?.igdbRating ?? null, fullGame.metacritic ?? null);
  const revCount = sRevCount || fullGame.ratings_count || 0;
  const conf = confidence(revCount, critN, steamRev != null);
  const vs = verdictScore(commScore, critScore, conf);
  const finalScore = vs > 0 ? vs : legacy;
  const relDate = fullGame.released ?? null;
  const isUpcoming = relDate ? new Date(relDate) > new Date() : false;
  const isJustRel = relDate ? (Date.now() - new Date(relDate).getTime()) < 14 * 86400000 && revCount < 20 : false;
  const vl = vs > 0 ? verdictLabel(vs, conf, isUpcoming, isJustRel) : legacyVerdict(finalScore);

  // ── Build record ──
  const ssUrls = screenshots.map(s => s.image);
  const platforms = mapPlatforms(fullGame.platforms);
  const genres = (fullGame.genres ?? []).map(g => g.name);
  const tags = (fullGame.tags ?? []).slice(0, 12).map(t => t.name);
  const dev = fullGame.developers?.[0]?.name ?? "";
  const pub = fullGame.publishers?.[0]?.name ?? "";
  // ══════════════════════════════════════════════════
  // COVER IMAGE SELECTION — NEW PRIORITY ORDER:
  //   1. IGDB cover (most reliable, high-quality)
  //   2. RAWG background_image (good fallback)
  //   3. Steam validated cover (last resort, unreliable)
  //   4. Keep existing trusted media or leave empty
  // ══════════════════════════════════════════════════
  const igdbCover = ie?.coverUrl ?? null;
  const igdbSS = ie?.screenshots ?? [];
  const rawgCover = fullGame.background_image || "";
  
  let cover = "";
  let mediaSource = null;
  let coverDebug = "";
  
  // Priority 1: IGDB cover (preferred)
  if (igdbCover) {
    cover = igdbCover;
    mediaSource = "igdb";
    coverDebug = "[cover] Using IGDB cover (priority 1)";
  }
  // Priority 2: RAWG background image
  else if (rawgCover) {
    cover = rawgCover;
    mediaSource = "rawg";
    coverDebug = "[cover] Using RAWG background (priority 2)";
  }
  // Priority 3: Steam validated cover (last resort)
  else if (steamAppId) {
    const steamResult = await validateAndGetSteamCover(steamAppId);
    if (steamResult?.coverUrl) {
      cover = steamResult.coverUrl;
      mediaSource = "steam";
      coverDebug = `[cover] Using Steam cover via ${steamResult.source} (priority 3 - fallback)`;
    } else {
      coverDebug = "[cover] Steam validation failed, no cover available";
    }
  }
  // No cover found
  else {
    coverDebug = "[cover] No cover sources available";
  }
  
  // Log cover source for debugging (can be disabled in production)
  if (process.env.DEBUG_MEDIA) console.log(`  ${fullGame.name}: ${coverDebug}`);
  
  // Header image: prefer IGDB screenshots, then RAWG additional/background
  // Header is separate from cover - don't use Steam for headers
  const header = igdbSS.length ? igdbSS[0] : (fullGame.background_image_additional ?? fullGame.background_image ?? "");
  const finalSS = igdbSS.length ? igdbSS : ssUrls;
  const freeTags = ["free-to-play","free to play","f2p"];
  const monetization = isFree ? "Free" : allTags.some(t => freeTags.includes(t)) ? "Free" : "Paid";
  const now = new Date().toISOString();

  const rec = {
    slug, title: fullGame.name, subtitle: null, cover_image: cover, header_image: header,
    screenshots: finalSS, platforms, genres, tags, developer: dev, publisher: pub,
    release_date: relDate, description: buildDesc(fullGame, igdbData, wikiData),
    score: finalScore, verdict_label: vl, verdict_summary: genSummary(fullGame.name, finalScore, genres),
    pros: genPros(fullGame, steamRev, igdbData, curPlayers), cons: genCons(fullGame, steamRev, igdbData),
    monetization, performance_notes: "", monetization_notes: "",
    steam_url: steamAppId ? `https://store.steampowered.com/app/${steamAppId}` : null,
    play_store_url: playStoreUrl, review_count: revCount,
    steam_positive_count: sPos, steam_total_count: sTot,
    community_score: commScore, critic_score: critScore, critic_source_count: critN,
    confidence: conf, verdict_score: vs > 0 ? vs : 0, user_score: sScore,
    featured: false, trending: false,
    rawg_id: fullGame.id, steam_app_id: steamAppId,
    price_current: pCur, price_currency: pCurr, price_lowest: pLow, price_deal_url: pDealUrl,
    is_free: isFree, current_players: curPlayers, peak_players_24h: null,
    trailer_url: ie?.trailerUrl ?? null, trailer_thumbnail: ie?.trailerThumbnail ?? null,
    igdb_id: ie?.igdbId ?? null, igdb_url: ie?.igdbUrl ?? null,
    igdb_rating: ie?.igdbRating ?? null, igdb_summary: ie?.igdbSummary ?? null,
    wikipedia_url: wikiUrl, wikipedia_excerpt: wikiExcerpt,
    metacritic_url: fullGame.metacritic_url ?? null,
    website_url: ie?.websiteUrl ?? fullGame.website ?? null,
    reddit_url: ie?.redditUrl ?? fullGame.reddit_url ?? null,
    cheapshark_id: csId, steam_rating_label: steamRev?.review_score_desc ?? null,
    rawg_metacritic: fullGame.metacritic ?? null, rawg_rating: fullGame.rating ?? null,
    score_source: scoreSrc,
    hltb_main: hltbData?.main ?? null, hltb_extras: hltbData?.extras ?? null,
    hltb_completionist: hltbData?.completionist ?? null, hltb_last_fetched: hltbData ? now : null,
    last_enriched_at: now, enrichment_sources: sources,
    media_source: mediaSource,
    is_provisional: !steamRev && !igdbData,
  };

  // ── 6. Upsert game ──
  let gameId;
  if (existing) {
    // UPDATE — preserve editorial fields that may have been manually edited
    // These fields are NEVER overwritten during re-enrichment:
    const ALWAYS_PRESERVE = new Set(["slug", "featured", "trending"]);
    // These fields are only overwritten if the existing value is empty/null:
    const EDITORIAL_FIELDS = new Set([
      "title", "subtitle", "description", "cover_image", "header_image",
      "screenshots", "pros", "cons", "verdict_summary",
      "performance_notes", "monetization_notes", "monetization",
      "developer", "publisher",
    ]);

    // Fetch current editorial values to check which ones are already set
    const [cur] = await sql`SELECT ${sql(["title","subtitle","description","cover_image","header_image",
      "screenshots","pros","cons","verdict_summary","performance_notes","monetization_notes",
      "monetization","developer","publisher","media_source"])} FROM games WHERE id = ${existing.id}`;

    const upd = {};
    for (const [key, val] of Object.entries(rec)) {
      if (ALWAYS_PRESERVE.has(key)) continue;
      if (EDITORIAL_FIELDS.has(key) && cur) {
        const curVal = cur[key];
        // Only overwrite if current DB value is empty/null/default
        const isEmpty = curVal === null || curVal === undefined || curVal === ""
          || (Array.isArray(curVal) && curVal.length === 0);
        if (!isEmpty) {
          // ══════════════════════════════════════════════════
          // NO-REGRESSION PROTECTION FOR MEDIA:
          // - Never overwrite IGDB/RAWG with Steam
          // - Only allow upgrades (igdb > rawg > steam)
          // ══════════════════════════════════════════════════
          if (key === "cover_image" && cur.media_source) {
            const existingSource = cur.media_source;
            const newSource = mediaSource;
            // Only overwrite if new source is better (lower priority number)
            if (!isMediaUpgrade(existingSource, newSource)) {
              if (process.env.DEBUG_MEDIA) {
                console.log(`  [no-regression] Keeping ${existingSource} cover, not replacing with ${newSource}`);
              }
              continue; // Keep existing better media
            }
            // Allow upgrade: e.g., replacing steam with igdb
            if (process.env.DEBUG_MEDIA) {
              console.log(`  [upgrade] Replacing ${existingSource} cover with ${newSource}`);
            }
          } else {
            continue; // preserve existing manual data for non-media fields
          }
        }
      }
      upd[key] = val;
    }

    if (Object.keys(upd).length > 0) {
      await sql`UPDATE games SET ${sql(upd)} WHERE id = ${existing.id}`;
    }
    gameId = existing.id;
  } else {
    // INSERT
    const [row] = await sql`INSERT INTO games ${sql(rec)} ON CONFLICT (slug) DO NOTHING RETURNING id`;
    if (row) { gameId = row.id; }
    else { const [ex] = await sql`SELECT id FROM games WHERE slug = ${slug} LIMIT 1`; gameId = ex?.id ?? null; }
  }

  if (!gameId) return { success: false, gameId: null, slug, message: "DB insert failed.", alreadyExisted: false };

  // ── 7. Source mappings ──
  await sql`INSERT INTO game_sources (game_id, source_name, source_game_id, source_url)
    VALUES (${gameId}, 'rawg', ${String(fullGame.id)}, ${"https://rawg.io/games/" + fullGame.slug})
    ON CONFLICT (source_name, source_game_id) DO UPDATE SET game_id = ${gameId}`.catch(() => {});
  if (steamAppId) await sql`INSERT INTO game_sources (game_id, source_name, source_game_id, source_url)
    VALUES (${gameId}, 'steam', ${String(steamAppId)}, ${"https://store.steampowered.com/app/" + steamAppId})
    ON CONFLICT (source_name, source_game_id) DO UPDATE SET game_id = ${gameId}`.catch(() => {});
  if (ie?.igdbId) await sql`INSERT INTO game_sources (game_id, source_name, source_game_id, source_url)
    VALUES (${gameId}, 'igdb', ${String(ie.igdbId)}, ${ie.igdbUrl})
    ON CONFLICT (source_name, source_game_id) DO UPDATE SET game_id = ${gameId}`.catch(() => {});
  if (csId) await sql`INSERT INTO game_sources (game_id, source_name, source_game_id, source_url)
    VALUES (${gameId}, 'cheapshark', ${csId}, ${pDealUrl})
    ON CONFLICT (source_name, source_game_id) DO UPDATE SET game_id = ${gameId}`.catch(() => {});

  return { success: true, gameId, slug, message: existing ? `"${fullGame.name}" refreshed.` : `"${fullGame.name}" ingested.`, alreadyExisted: !!existing };
}

// ══════════════════════════════════════════════════
// Re-Enrich Batch (Direct DB)
// ══════════════════════════════════════════════════
/**
 * Find stale games and re-enrich them in batch.
 * @param {import('postgres').Sql} sql
 * @param {object} [options]
 * @param {number} [options.limit] - max games per run (default 10, max 50)
 */
export async function reEnrichBatch(sql, { limit = 10 } = {}) {
  const batchLimit = Math.min(Math.max(1, limit), 50);
  const cutoff = new Date(Date.now() - 24 * 3600000).toISOString();
  const lockCutoff = new Date(Date.now() - 10 * 60000).toISOString();
  const recentCutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const log = [];

  // Fast-path: recently released under-enriched games
  const fp = await sql`
    SELECT id, title, slug, last_enriched_at, review_count, release_date
    FROM games WHERE release_date >= ${recentCutoff} AND release_date <= ${today}
      AND review_count < 100
      AND (is_refreshing = false OR is_refreshing IS NULL OR refresh_started_at < ${lockCutoff} OR refresh_started_at IS NULL)
    ORDER BY release_date DESC LIMIT ${Math.min(batchLimit, 10)}`;
  const fpIds = new Set(fp.map(g => g.id));
  if (fp.length) { log.push(`Fast-path: ${fp.length} recent releases`); for (const g of fp) log.push(`  ${g.title} (${g.release_date}, ${g.review_count} reviews)`); }

  // Standard stale games
  const rem = batchLimit - fp.length;
  let stale = [];
  if (rem > 0) {
    stale = (await sql`
      SELECT id, title, slug, last_enriched_at FROM games
      WHERE (last_enriched_at < ${cutoff} OR last_enriched_at IS NULL)
        AND (is_refreshing = false OR is_refreshing IS NULL OR refresh_started_at < ${lockCutoff} OR refresh_started_at IS NULL)
      ORDER BY last_enriched_at ASC NULLS FIRST LIMIT ${rem}`).filter(g => !fpIds.has(g.id));
  }

  const all = [...fp, ...stale];
  if (!all.length) return { refreshed: 0, failed: 0, total: 0, log: ["No stale games found"] };
  log.push(`${all.length} games to re-enrich (${fp.length} fast-path + ${stale.length} standard)`);

  let ok = 0, fail = 0;
  for (const game of all) {
    const now = new Date().toISOString();
    // Acquire lock
    try { const [lk] = await sql`UPDATE games SET is_refreshing = true, refresh_started_at = ${now}
      WHERE id = ${game.id} AND (is_refreshing = false OR is_refreshing IS NULL OR refresh_started_at < ${lockCutoff} OR refresh_started_at IS NULL) RETURNING id`;
      if (!lk) { log.push(`SKIP ${game.title} — locked`); continue; }
    } catch { /* lock cols may not exist */ }

    try {
      const r = await ingestGameDirect(sql, game.title, { forceRefresh: true });
      if (r.success) { ok++; log.push(`OK ${game.title}`); } else { fail++; log.push(`FAIL ${game.title} — ${r.message}`); }
    } catch (e) { fail++; log.push(`ERR ${game.title} — ${e.message}`); }
    finally { try { await sql`UPDATE games SET is_refreshing = false, refresh_started_at = NULL WHERE id = ${game.id}`; } catch {} }

    await new Promise(r => setTimeout(r, 500)); // rate limit
  }
  return { refreshed: ok, failed: fail, total: all.length, fastPathCount: fp.length, staleCount: stale.length, log };
}
