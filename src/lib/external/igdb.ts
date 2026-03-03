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
 * Get a single IGDB game by its ID with full details.
 */
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
  // Search with title
  let query = `search "${escapeQuotes(title)}";
     fields name, slug, summary, storyline,
            aggregated_rating, rating, total_rating,
            first_release_date, url, cover.image_id,
            genres.name, platforms.name,
            videos.video_id, videos.name,
            websites.url, websites.category;
     limit 5;`;

  const results = await igdbQuery<IgdbGame>("games", query);
  if (!results?.length) return null;

  // Try to find best match by name similarity and release year
  const normalizedTitle = title.toLowerCase().trim();

  let bestMatch = results[0];
  for (const game of results) {
    const gameName = game.name.toLowerCase().trim();

    // Exact name match is best
    if (gameName === normalizedTitle) {
      bestMatch = game;
      break;
    }

    // Check release year if provided
    if (releaseYear && game.first_release_date) {
      const gameYear = new Date(game.first_release_date * 1000).getFullYear();
      if (gameYear === releaseYear) {
        bestMatch = game;
        // Don't break — exact name match is still better
      }
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
} {
  // Extract YouTube trailer from videos
  let trailerUrl: string | null = null;
  let trailerThumbnail: string | null = null;
  if (game.videos?.length) {
    const videoId = game.videos[0].video_id;
    trailerUrl = `https://www.youtube.com/watch?v=${videoId}`;
    trailerThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
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
