/**
 * VERDICT.GAMES — IGDB (Internet Game Database) API Integration
 *
 * Rich game metadata via Twitch/IGDB.
 * Requires Twitch OAuth: client_id + client_secret → bearer token.
 * Uses Apicalypse query language in POST body.
 *
 * Rate limit: 4 requests/second.
 * Free for non-commercial use.
 *
 * Docs: https://api-docs.igdb.com/
 * Server-only — never import in client code.
 */

const IGDB_BASE = "https://api.igdb.com/v4";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";

/* ───────── Token Management ───────── */

let cachedToken: { access_token: string; expires_at: number } | null = null;

/**
 * Get a valid Twitch OAuth token for IGDB requests.
 * Uses client credentials flow — tokens last ~60 days.
 * Caches the token in memory and refreshes when expired.
 */
async function getIgdbToken(): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    // IGDB is optional — gracefully return null if not configured
    return null;
  }

  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && Date.now() < cachedToken.expires_at - 300_000) {
    return cachedToken.access_token;
  }

  try {
    const res = await fetch(TWITCH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });

    if (!res.ok) {
      console.error(`[IGDB] Token fetch failed: ${res.status}`);
      return null;
    }

    const data = await res.json() as {
      access_token: string;
      expires_in: number;
      token_type: string;
    };

    cachedToken = {
      access_token: data.access_token,
      expires_at: Date.now() + data.expires_in * 1000,
    };

    console.log("[IGDB] Token obtained, expires in", Math.round(data.expires_in / 3600), "hours");
    return cachedToken.access_token;
  } catch (err) {
    console.error("[IGDB] Token fetch error:", err);
    return null;
  }
}

/* ───────── Response Types ───────── */

export interface IgdbGame {
  id: number;
  name: string;
  slug: string;
  summary?: string;
  storyline?: string;
  aggregated_rating?: number;      // 0-100 average from external critics
  aggregated_rating_count?: number;
  rating?: number;                 // 0-100 IGDB user rating
  rating_count?: number;
  total_rating?: number;           // combined
  total_rating_count?: number;
  first_release_date?: number;     // epoch
  url?: string;                    // IGDB page URL
  cover?: { id: number; image_id: string };
  screenshots?: { id: number; image_id: string }[];
  videos?: { id: number; video_id: string; name: string }[]; // YouTube video IDs
  websites?: { id: number; url: string; category: number }[];
  genres?: { id: number; name: string }[];
  themes?: { id: number; name: string }[];
  platforms?: { id: number; name: string; abbreviation?: string }[];
  involved_companies?: {
    id: number;
    company: { id: number; name: string };
    developer: boolean;
    publisher: boolean;
  }[];
  similar_games?: { id: number; name: string; slug: string; cover?: { image_id: string } }[];
  game_modes?: { id: number; name: string }[];      // Single player, Multiplayer, etc.
  player_perspectives?: { id: number; name: string }[]; // First person, Third person, etc.
}

/** IGDB Website category enum */
export const IGDB_WEBSITE_CATEGORY = {
  OFFICIAL: 1,
  WIKIA: 2,
  WIKIPEDIA: 3,
  FACEBOOK: 4,
  TWITTER: 5,
  TWITCH: 6,
  INSTAGRAM: 8,
  YOUTUBE: 9,
  IPHONE: 10,
  IPAD: 11,
  ANDROID: 12,
  STEAM: 13,
  REDDIT: 14,
  ITCH: 15,
  EPIC: 16,
  GOG: 17,
  DISCORD: 18,
} as const;

/* ───────── Core Query Function ───────── */

/**
 * Execute an Apicalypse query against an IGDB endpoint.
 * Returns null if IGDB is not configured (missing Twitch credentials).
 */
async function igdbQuery<T>(
  endpoint: string,
  body: string
): Promise<T[] | null> {
  const token = await getIgdbToken();
  if (!token) return null;

  const clientId = process.env.TWITCH_CLIENT_ID!;

  try {
    const res = await fetch(`${IGDB_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body,
    });

    if (!res.ok) {
      console.error(`[IGDB] Query to /${endpoint} failed: ${res.status}`);
      return null;
    }

    return res.json() as Promise<T[]>;
  } catch (err) {
    console.error(`[IGDB] Query to /${endpoint} error:`, err);
    return null;
  }
}

/* ───────── API Functions ───────── */

/**
 * Search IGDB for games matching a query.
 * Returns expanded results with cover, genres, platforms, websites.
 */
export async function searchIgdb(
  query: string,
  limit = 5
): Promise<IgdbGame[] | null> {
  return igdbQuery<IgdbGame>(
    "games",
    `search "${escapeQuotes(query)}";
     fields name, slug, summary, aggregated_rating, rating, total_rating,
            first_release_date, url, cover.image_id,
            genres.name, platforms.name, platforms.abbreviation,
            websites.url, websites.category,
            videos.video_id, videos.name;
     limit ${limit};`
  );
}

/**
 * Exact IGDB slug lookup (e.g. "scott-pilgrim-ex").
 * Used when RAWG has no match but IGDB lists the title.
 */
export async function getIgdbGameBySlug(slug: string): Promise<IgdbGame | null> {
  const safe = slug.trim().toLowerCase();
  if (!safe || !/^[a-z0-9-]+$/.test(safe)) return null;

  const results = await igdbQuery<IgdbGame>(
    "games",
    `where slug = "${safe}";
     fields name, slug, summary, storyline,
            aggregated_rating, aggregated_rating_count,
            rating, rating_count, total_rating, total_rating_count,
            first_release_date, url, cover.image_id,
            screenshots.image_id,
            genres.name, platforms.name, platforms.abbreviation,
            involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
            videos.video_id, videos.name,
            websites.url, websites.category;
     limit 1;`
  );

  return results?.[0] ?? null;
}

/** Compare slugs ignoring punctuation (GX `rhythmstrike` vs IGDB `rhythm-strike`). */
function normalizeSlugKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Resolve an IGDB game for a site URL slug from GX/calendar.
 * GX slugs often differ from IGDB (`rhythmstrike` vs `rhythm-strike`), so we
 * exact-match first, then search + normalized slug / name heuristics.
 */
export async function resolveIgdbGameForExternalSlug(urlSlug: string): Promise<IgdbGame | null> {
  if (!isIgdbConfigured()) return null;

  const trimmed = urlSlug.trim().toLowerCase();
  if (!trimmed || !/^[a-z0-9-]+$/.test(trimmed)) return null;

  const targetKey = normalizeSlugKey(trimmed);

  const byExact = await getIgdbGameBySlug(trimmed);
  if (byExact) {
    const full = await getIgdbGame(byExact.id);
    return full ?? byExact;
  }

  const searchQueries = new Set<string>();
  searchQueries.add(trimmed.replace(/-/g, " "));
  if (trimmed.includes("-")) {
    searchQueries.add(trimmed.replace(/-/g, ""));
  }
  // e.g. rhythmstrike → try splitting implied words is unreliable; IGDB search handles fuzzy match

  const merged = new Map<number, IgdbGame>();
  for (const q of searchQueries) {
    const t = q.trim();
    if (t.length < 2) continue;
    const hits = await searchIgdb(t, 20);
    for (const h of hits ?? []) merged.set(h.id, h);
  }

  const candidates = [...merged.values()];
  if (candidates.length === 0) return null;

  let best: IgdbGame | null = null;
  for (const g of candidates) {
    if (normalizeSlugKey(g.slug) === targetKey) {
      best = g;
      break;
    }
  }
  if (!best) {
    for (const g of candidates) {
      const gk = normalizeSlugKey(g.slug);
      if (gk.includes(targetKey) || targetKey.includes(gk)) {
        best = g;
        break;
      }
    }
  }
  if (!best) {
    const words = trimmed.replace(/-/g, " ").split(/\s+/).filter((w) => w.length > 0);
    for (const g of candidates) {
      const nl = g.name.toLowerCase();
      if (words.length && words.every((w) => nl.includes(w))) {
        best = g;
        break;
      }
    }
  }

  if (!best) return null;

  const full = await getIgdbGame(best.id);
  return full ?? best;
}

export async function getIgdbGame(igdbId: number): Promise<IgdbGame | null> {
  const results = await igdbQuery<IgdbGame>(
    "games",
    `where id = ${igdbId};
     fields name, slug, summary, storyline,
            aggregated_rating, aggregated_rating_count,
            rating, rating_count, total_rating, total_rating_count,
            first_release_date, url, cover.image_id,
            screenshots.image_id,
            genres.name, themes.name,
            platforms.name, platforms.abbreviation,
            involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
            videos.video_id, videos.name,
            websites.url, websites.category,
            similar_games.name, similar_games.slug, similar_games.cover.image_id,
            game_modes.name, player_perspectives.name;
     limit 1;`
  );

  return results?.[0] ?? null;
}

/**
 * Find the best IGDB match for a game title.
 * Used during ingestion — tries to match by name.
 */
export async function findIgdbMatch(
  title: string,
  releaseYear?: number
): Promise<IgdbGame | null> {
  // Search with title — include cover, screenshots, and videos for enrichment
  // Filter to main games only (game_type 0 = main_game) to avoid DLC/mods
  const query = `search "${escapeQuotes(title)}";
     fields name, slug, summary, storyline,
            aggregated_rating, rating, total_rating,
            first_release_date, url, cover.image_id,
            screenshots.image_id,
            genres.name, platforms.name,
            videos.video_id, videos.name,
            websites.url, websites.category;
     where game_type = 0;
     limit 10;`;

  const results = await igdbQuery<IgdbGame>("games", query);
  if (!results?.length) return null;

  // Score each result for best match
  const normalizedTitle = title.toLowerCase().trim();

  let bestMatch = results[0];
  let bestScore = -Infinity;

  for (const game of results) {
    let score = 0;
    const gameName = game.name.toLowerCase().trim();

    // Exact name match gets highest score
    if (gameName === normalizedTitle) {
      score += 100;
    } else if (gameName.includes(normalizedTitle) || normalizedTitle.includes(gameName)) {
      score += 50;
    }

    // Release year matching (critical for disambiguation)
    if (releaseYear && game.first_release_date) {
      const gameYear = new Date(game.first_release_date * 1000).getFullYear();
      if (gameYear === releaseYear) {
        score += 80; // Strong match
      } else if (Math.abs(gameYear - releaseYear) === 1) {
        score += 30; // Close year (off by 1)
      } else if (Math.abs(gameYear - releaseYear) > 5) {
        score -= 40; // Penalize very different years
      }
    }

    // Prefer games with cover images and screenshots (more complete data)
    if (game.cover?.image_id) score += 10;
    if (game.screenshots?.length) score += 5;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = game;
    }
  }

  return bestMatch;
}

/**
 * Extract enrichment data from an IGDB game for our ingestion pipeline.
 */
export function extractIgdbEnrichment(game: IgdbGame): {
  igdbId: number;
  igdbUrl: string | null;
  igdbRating: number | null;
  igdbSummary: string | null;
  trailerUrl: string | null;
  trailerThumbnail: string | null;
  wikipediaUrl: string | null;
  websiteUrl: string | null;
  redditUrl: string | null;
  coverImageUrl: string | null;
  screenshotUrls: string[];
} {
  // Extract YouTube trailer from videos — pick best by confidence
  let trailerUrl: string | null = null;
  let trailerThumbnail: string | null = null;
  if (game.videos?.length) {
    const bestVideo = pickBestTrailer(game.videos, game.name);
    if (bestVideo) {
      trailerUrl = `https://www.youtube.com/watch?v=${bestVideo.video_id}`;
      trailerThumbnail = `https://img.youtube.com/vi/${bestVideo.video_id}/hqdefault.jpg`;
    }
  }

  // Extract URLs from websites
  let wikipediaUrl: string | null = null;
  let websiteUrl: string | null = null;
  let redditUrl: string | null = null;

  if (game.websites) {
    for (const site of game.websites) {
      switch (site.category) {
        case IGDB_WEBSITE_CATEGORY.WIKIPEDIA:
          wikipediaUrl = site.url;
          break;
        case IGDB_WEBSITE_CATEGORY.OFFICIAL:
          websiteUrl = site.url;
          break;
        case IGDB_WEBSITE_CATEGORY.REDDIT:
          redditUrl = site.url;
          break;
      }
    }
  }

  // Extract cover image
  const coverImageUrl = game.cover?.image_id
    ? igdbImageUrl(game.cover.image_id, "cover_big_2x")
    : null;

  // Extract screenshots
  const screenshotUrls = (game.screenshots ?? [])
    .slice(0, 6)
    .map((s) => igdbImageUrl(s.image_id, "screenshot_big"));

  return {
    igdbId: game.id,
    igdbUrl: game.url ?? null,
    igdbRating: game.aggregated_rating
      ? Math.round(game.aggregated_rating)
      : null,
    igdbSummary: game.storyline || game.summary || null,
    trailerUrl,
    trailerThumbnail,
    wikipediaUrl,
    websiteUrl,
    redditUrl,
    coverImageUrl,
    screenshotUrls,
  };
}

/* ───────── Image Helpers ───────── */

/**
 * Build an IGDB image URL from an image_id.
 * Sizes: cover_small, cover_big, screenshot_med, screenshot_big, screenshot_huge, 720p, 1080p
 */
export function igdbImageUrl(imageId: string, size: string = "cover_big"): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

/* ───────── PopScore / Popularity Primitives ───────── */

/**
 * IGDB Popularity Types:
 * 1 = IGDB Visits
 * 2 = Want to Play
 * 3 = Playing
 * 4 = Played
 * 5 = Steam 24hr Peak Players
 * 6 = Steam Positive Reviews
 * 7 = Steam Negative Reviews
 * 8 = Steam Total Reviews
 */

export interface PopularityPrimitive {
  id: number;
  game_id: number;
  popularity_type: number;
  value: number;
}

/**
 * Fetch top games by an IGDB popularity type.
 * Returns game IDs sorted by popularity value descending.
 */
export async function getPopularByType(
  popularityType: number,
  limit = 50
): Promise<PopularityPrimitive[] | null> {
  return igdbQuery<PopularityPrimitive>(
    "popularity_primitives",
    `fields game_id, value, popularity_type;
     sort value desc;
     limit ${limit};
     where popularity_type = ${popularityType};`
  );
}

/**
 * Fetch game names for a list of IGDB game IDs.
 */
export async function getIgdbGamesByIds(
  ids: number[],
  limit = 50
): Promise<IgdbGame[] | null> {
  if (ids.length === 0) return [];
  return igdbQuery<IgdbGame>(
    "games",
    `fields name, slug, first_release_date, total_rating, cover.image_id,
            genres.name, platforms.name, platforms.abbreviation, hypes;
     where id = (${ids.join(",")}) & game_type = 0;
     limit ${limit};`
  );
}

/**
 * Get currently trending games using IGDB PopScore.
 * Combines: IGDB Visits (type 1), Want to Play (type 2), Playing (type 3), Steam Peak Players (type 5).
 * Returns a weighted list of IGDB game IDs with scores.
 */
export async function getTrendingFromIgdb(
  limit = 40
): Promise<{ igdbId: number; name: string; slug: string; popScore: number }[]> {
  // Fetch multiple popularity types in parallel
  const [visits, wantToPlay, playing, steamPeak] = await Promise.all([
    getPopularByType(1, 100),  // IGDB Visits
    getPopularByType(2, 100),  // Want to Play
    getPopularByType(3, 100),  // Playing
    getPopularByType(5, 100),  // Steam 24hr Peak Players
  ]);

  if (!visits && !wantToPlay && !playing && !steamPeak) return [];

  // Build a combined score map: igdbId -> weighted score
  const scoreMap = new Map<number, number>();

  const weights = { visits: 0.25, wantToPlay: 0.30, playing: 0.30, steamPeak: 0.15 };

  function addScores(items: PopularityPrimitive[] | null, weight: number) {
    if (!items) return;
    // Normalize: top item = 1.0
    const maxVal = items[0]?.value || 1;
    for (const item of items) {
      const normalized = item.value / maxVal;
      scoreMap.set(
        item.game_id,
        (scoreMap.get(item.game_id) || 0) + normalized * weight
      );
    }
  }

  addScores(visits, weights.visits);
  addScores(wantToPlay, weights.wantToPlay);
  addScores(playing, weights.playing);
  addScores(steamPeak, weights.steamPeak);

  // Sort by combined score
  const sorted = [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const igdbIds = sorted.map(([id]) => id);
  const games = await getIgdbGamesByIds(igdbIds);
  if (!games) return [];

  // Map back with scores
  const gameMap = new Map(games.map((g) => [g.id, g]));
  return sorted
    .filter(([id]) => gameMap.has(id))
    .map(([id, popScore]) => {
      const g = gameMap.get(id)!;
      return { igdbId: id, name: g.name, slug: g.slug, popScore };
    });
}

/* ───────── Trailer Selection ───────── */

/** Preferred trailer title keywords, ordered by priority. */
const TRAILER_KEYWORDS = [
  "official trailer",
  "launch trailer",
  "announcement trailer",
  "reveal trailer",
  "gameplay trailer",
  "cinematic trailer",
  "trailer",
  "official",
];

/**
 * Pick the best trailer video from IGDB videos list.
 * Scores each video by title similarity to the game name and presence of
 * preferred keywords. Returns null if no video has sufficient confidence.
 */
function pickBestTrailer(
  videos: { id: number; video_id: string; name: string }[],
  gameName: string
): { video_id: string; name: string } | null {
  if (!videos.length) return null;

  const gameWords = gameName.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);

  let bestScore = -1;
  let bestVideo: (typeof videos)[0] | null = null;

  for (const video of videos) {
    const vName = (video.name ?? "").toLowerCase();
    let score = 0;

    // Keyword bonus: preferred trailer types get higher scores
    for (let i = 0; i < TRAILER_KEYWORDS.length; i++) {
      if (vName.includes(TRAILER_KEYWORDS[i])) {
        score += (TRAILER_KEYWORDS.length - i) * 10;
        break;
      }
    }

    // Title similarity: how many game-name words appear in the video title
    const matchingWords = gameWords.filter((w) => w.length > 2 && vName.includes(w));
    score += matchingWords.length * 5;

    // Penalize videos that look unrelated (no game words AND no trailer keywords)
    if (matchingWords.length === 0 && !TRAILER_KEYWORDS.some((k) => vName.includes(k))) {
      score -= 20;
    }

    if (score > bestScore) {
      bestScore = score;
      bestVideo = video;
    }
  }

  // Only return if we have some confidence (score > 0), otherwise skip
  // A score of 0 means no keywords matched and no game-name words matched
  if (bestScore <= 0 && videos.length > 0) {
    // Fallback: if there's only one video, use it (likely correct)
    if (videos.length === 1) return videos[0];
    return null;
  }

  return bestVideo;
}

/* ───────── Utilities ───────── */

function escapeQuotes(str: string): string {
  return str.replace(/"/g, '\\"');
}

/**
 * Check if IGDB integration is available (Twitch credentials configured).
 */
export function isIgdbConfigured(): boolean {
  return !!(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
}
