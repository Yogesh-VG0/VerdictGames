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
