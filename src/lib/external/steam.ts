/**
 * VERDICT.GAMES — Steam API Integration
 *
 * Fetches review data and store details from Steam.
 * Server-only — never import in client code.
 *
 * Uses the Steam Store API (no key required for public data)
 * and the Steamworks Web API (key required for some endpoints).
 */

const STEAM_STORE_BASE = "https://store.steampowered.com/api";
const STEAM_API_BASE = "https://api.steampowered.com";

/* ───────── Response Types ───────── */

export interface SteamPlayerCount {
  response: {
    player_count: number;
    result: number; // 1 = success
  };
}

export interface SteamAppDetails {
  success: boolean;
  data?: {
    type: string;
    name: string;
    steam_appid: number;
    required_age: number;
    is_free: boolean;
    detailed_description: string;
    about_the_game: string;
    short_description: string;
    header_image: string;
    capsule_image: string;
    website: string | null;
    developers: string[];
    publishers: string[];
    price_overview?: {
      currency: string;
      initial: number;
      final: number;
      discount_percent: number;
      final_formatted: string;
    };
    platforms: {
      windows: boolean;
      mac: boolean;
      linux: boolean;
    };
    metacritic?: {
      score: number;
      url: string;
    };
    categories?: { id: number; description: string }[];
    genres?: { id: string; description: string }[];
    screenshots?: { id: number; path_thumbnail: string; path_full: string }[];
    release_date?: {
      coming_soon: boolean;
      date: string;
    };
  };
}

export interface SteamReviewSummary {
  success: number;
  query_summary: {
    num_reviews: number;
    review_score: number; // 1-9 scale
    review_score_desc: string; // "Very Positive", "Mixed", etc.
    total_positive: number;
    total_negative: number;
    total_reviews: number;
  };
}

/* ───────── API Functions ───────── */

/**
 * Get Steam app details for a given App ID.
 * No API key required — public endpoint.
 */
export async function getSteamAppDetails(
  appId: number
): Promise<SteamAppDetails["data"] | null> {
  try {
    const res = await fetch(
      `${STEAM_STORE_BASE}/appdetails?appids=${appId}&l=english`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) return null;

    const data: Record<string, SteamAppDetails> = await res.json();
    const entry = data[String(appId)];

    if (!entry?.success || !entry.data) return null;
    return entry.data;
  } catch {
    console.error(`[Steam] Failed to fetch app details for ${appId}`);
    return null;
  }
}

/**
 * Get Steam review summary for a given App ID.
 * No API key required — public endpoint.
 */
export async function getSteamReviewSummary(
  appId: number
): Promise<SteamReviewSummary["query_summary"] | null> {
  try {
    const reviewRes = await fetch(
      `https://store.steampowered.com/appreviews/${appId}?json=1&language=all&purchase_type=all&num_per_page=0`,
      { next: { revalidate: 1800 } }
    );

    if (!reviewRes.ok) return null;

    const data: SteamReviewSummary = await reviewRes.json();
    if (data.success !== 1) return null;

    return data.query_summary;
  } catch {
    console.error(`[Steam] Failed to fetch review summary for ${appId}`);
    return null;
  }
}

/**
 * Get current player count for a Steam game.
 * No API key required — public endpoint.
 */
export async function getSteamPlayerCount(
  appId: number
): Promise<number | null> {
  try {
    const res = await fetch(
      `${STEAM_API_BASE}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appId}`,
      { next: { revalidate: 300 } } // cache 5 min — player count changes frequently
    );

    if (!res.ok) return null;

    const data: SteamPlayerCount = await res.json();
    if (data.response.result !== 1) return null;

    return data.response.player_count;
  } catch {
    console.error(`[Steam] Failed to fetch player count for ${appId}`);
    return null;
  }
}

/**
 * Extract price data from a Steam app details response.
 * Returns price in cents, or null if free / not available.
 */
export function extractSteamPrice(
  appData: SteamAppDetails["data"]
): {
  priceCurrent: number | null;  // cents
  priceCurrency: string;
  isFree: boolean;
} {
  if (!appData) return { priceCurrent: null, priceCurrency: "USD", isFree: false };

  if (appData.is_free) {
    return { priceCurrent: 0, priceCurrency: "USD", isFree: true };
  }

  if (appData.price_overview) {
    return {
      priceCurrent: appData.price_overview.final,   // already in cents
      priceCurrency: appData.price_overview.currency,
      isFree: false,
    };
  }

  return { priceCurrent: null, priceCurrency: "USD", isFree: false };
}

/**
 * Convert Steam's review score description to a 0-100 percentage.
 */
export function steamScoreToPercent(
  positive: number,
  total: number
): number {
  if (total === 0) return 0;
  return Math.round((positive / total) * 100);
}

/**
 * Build the Steam store URL for an App ID.
 */
export function steamStoreUrl(appId: number): string {
  return `https://store.steampowered.com/app/${appId}`;
}

/* ═══════════════════════════════════════════════════
   STEAM WEB API — Key-Required & Public Endpoints
   ═══════════════════════════════════════════════════ */

const STEAM_API_KEY = process.env.STEAM_API_KEY;

/* ───────── News Types ───────── */

export interface SteamNewsItem {
  gid: string;
  title: string;
  url: string;
  author: string;
  contents: string;        // may contain HTML/BBCode
  feedlabel: string;       // e.g. "Community Announcements"
  date: number;            // Unix timestamp
  feedname: string;
  appid: number;
  tags?: string[];
}

interface SteamNewsResponse {
  appnews: {
    appid: number;
    newsitems: SteamNewsItem[];
    count: number;
  };
}

/* ───────── Achievement Types ───────── */

export interface SteamAchievement {
  name: string;            // internal API name
  displayName: string;     // human-readable name
  description?: string;
  icon: string;            // URL to unlocked icon
  icongray: string;        // URL to locked icon
  percent: number;         // global unlock percentage
}

interface SchemaForGameResponse {
  game: {
    gameName: string;
    availableGameStats?: {
      achievements?: {
        name: string;
        defaultvalue: number;
        displayName: string;
        hidden: number;
        description?: string;
        icon: string;
        icongray: string;
      }[];
    };
  };
}

interface GlobalAchievementResponse {
  achievementpercentages: {
    achievements: {
      name: string;
      percent: number;
    }[];
  };
}

/* ───────── News API ───────── */

/**
 * Get latest news/patch notes for a Steam game.
 * No API key required — public endpoint.
 *
 * ISteamNews/GetNewsForApp/v2
 */
export async function getSteamNews(
  appId: number,
  count = 5,
  maxLength = 500
): Promise<SteamNewsItem[]> {
  try {
    const res = await fetch(
      `${STEAM_API_BASE}/ISteamNews/GetNewsForApp/v2/?appid=${appId}&count=${count}&maxlength=${maxLength}&format=json`,
      { next: { revalidate: 1800 } } // cache 30 min
    );

    if (!res.ok) return [];

    const data: SteamNewsResponse = await res.json();
    return data?.appnews?.newsitems ?? [];
  } catch {
    console.error(`[Steam] Failed to fetch news for ${appId}`);
    return [];
  }
}

/* ───────── Achievement Stats API ───────── */

type AchievementSchemaItem = {
  name: string;
  defaultvalue: number;
  displayName: string;
  hidden: number;
  description?: string;
  icon: string;
  icongray: string;
};

/**
 * Get achievement schema (names, descriptions, icons) for a game.
 * Requires API key.
 *
 * ISteamUserStats/GetSchemaForGame/v2
 */
export async function getSteamAchievementSchema(
  appId: number
): Promise<AchievementSchemaItem[] | null> {
  if (!STEAM_API_KEY) return null;
  try {
    const res = await fetch(
      `${STEAM_API_BASE}/ISteamUserStats/GetSchemaForGame/v2/?key=${STEAM_API_KEY}&appid=${appId}&l=english`,
      { next: { revalidate: 86400 } } // cache 24h — schema rarely changes
    );

    if (!res.ok) return null;

    const data: SchemaForGameResponse = await res.json();
    return data?.game?.availableGameStats?.achievements ?? null;
  } catch {
    console.error(`[Steam] Failed to fetch achievement schema for ${appId}`);
    return null;
  }
}

/**
 * Get global achievement unlock percentages (public, no key required).
 *
 * ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2
 */
export async function getSteamGlobalAchievements(
  appId: number
): Promise<Map<string, number>> {
  try {
    const res = await fetch(
      `${STEAM_API_BASE}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appId}&format=json`,
      { next: { revalidate: 3600 } } // cache 1h
    );

    if (!res.ok) return new Map();

    const data: GlobalAchievementResponse = await res.json();
    const map = new Map<string, number>();
    for (const a of data?.achievementpercentages?.achievements ?? []) {
      map.set(a.name, Math.round(a.percent * 10) / 10);
    }
    return map;
  } catch {
    console.error(`[Steam] Failed to fetch global achievements for ${appId}`);
    return new Map();
  }
}

/**
 * Get merged achievement data: schema + global unlock percentages.
 * Returns achievements sorted by unlock % descending.
 */
export async function getSteamAchievements(
  appId: number
): Promise<SteamAchievement[]> {
  const [schema, percentages] = await Promise.all([
    getSteamAchievementSchema(appId),
    getSteamGlobalAchievements(appId),
  ]);

  if (!schema) return [];

  return schema
    .filter((a) => a.hidden === 0) // exclude hidden achievements
    .map((a) => ({
      name: a.name,
      displayName: a.displayName,
      description: a.description,
      icon: a.icon,
      icongray: a.icongray,
      percent: percentages.get(a.name) ?? 0,
    }))
    .sort((a, b) => b.percent - a.percent);
}
