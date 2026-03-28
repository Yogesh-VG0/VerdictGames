/**
 * VERDICT.GAMES — RAWG API Integration
 *
 * Fetches game metadata from RAWG.io.
 * Server-only — never import in client code.
 *
 * Docs: https://rawg.io/apidocs
 */

import { recordProviderUsage } from "@/lib/utils/providerUsage";

const RAWG_BASE = "https://api.rawg.io/api";

function getApiKey(): string {
  const key = process.env.RAWG_API_KEY;
  if (!key) throw new Error("Missing RAWG_API_KEY environment variable.");
  return key;
}

/**
 * Tracked fetch for RAWG API - non-blocking usage recording.
 */
async function trackedFetch(endpoint: string, url: string, init?: RequestInit): Promise<Response> {
  const start = Date.now();
  try {
    const res = await fetch(url, init);
    // Fire-and-forget tracking (non-blocking)
    recordProviderUsage("rawg", endpoint, res.ok, Date.now() - start);
    return res;
  } catch (err) {
    recordProviderUsage("rawg", endpoint, false, Date.now() - start);
    throw err;
  }
}

/* ───────── Response Types ───────── */

export interface RawgSearchResult {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  background_image: string | null;
  rating: number;
  ratings_count: number;
  metacritic: number | null;
  platforms: { platform: { id: number; name: string; slug: string } }[] | null;
  genres: { id: number; name: string; slug: string }[] | null;
  tags: { id: number; name: string; slug: string }[] | null;
  short_screenshots: { id: number; image: string }[] | null;
  stores: { store: { id: number; name: string; slug: string }; url: string }[] | null;
}

export interface RawgSearchResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: RawgSearchResult[];
}

export interface RawgGameDetail extends RawgSearchResult {
  name_original: string;
  description_raw: string;
  description: string; // HTML
  developers: { id: number; name: string; slug: string }[];
  publishers: { id: number; name: string; slug: string }[];
  background_image_additional: string | null;
  website: string | null;
  reddit_url: string | null;
  metacritic_url: string | null;
  screenshots_count: number;
}

export interface RawgScreenshot {
  id: number;
  image: string;
  width: number;
  height: number;
}

export interface RawgScreenshotsResponse {
  count: number;
  results: RawgScreenshot[];
}

/* ───────── API Functions ───────── */

/**
 * Search RAWG for games matching a query.
 * Returns up to `pageSize` results (default 10).
 */
export async function searchRawg(
  query: string,
  page = 1,
  pageSize = 10
): Promise<RawgSearchResponse> {
  const params = new URLSearchParams({
    key: getApiKey(),
    search: query,
    page: String(page),
    page_size: String(pageSize),
    search_precise: "true",
  });

  const res = await trackedFetch("search", `${RAWG_BASE}/games?${params}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`RAWG search failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Get full game details from RAWG by ID.
 */
export async function getRawgGame(id: number): Promise<RawgGameDetail> {
  const params = new URLSearchParams({ key: getApiKey() });

  const res = await trackedFetch("game", `${RAWG_BASE}/games/${id}?${params}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`RAWG game fetch failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Get screenshots for a RAWG game.
 */
export async function getRawgScreenshots(id: number): Promise<RawgScreenshot[]> {
  const params = new URLSearchParams({
    key: getApiKey(),
    page_size: "10",
  });

  const res = await trackedFetch("screenshots", `${RAWG_BASE}/games/${id}/screenshots?${params}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`RAWG screenshots fetch failed: ${res.status} ${res.statusText}`);
  }

  const data: RawgScreenshotsResponse = await res.json();
  return data.results;
}

/* ───────── Store Links ───────── */

export interface RawgStoreLink {
  id: number;
  game_id: number;
  store_id: number;
  url: string;
}

/**
 * Fetch actual store URLs from RAWG's dedicated /games/{id}/stores endpoint.
 * The main game detail endpoint often returns empty `url` fields.
 */
export async function getRawgStoreLinks(gameId: number): Promise<RawgStoreLink[]> {
  const params = new URLSearchParams({ key: getApiKey() });

  const res = await trackedFetch("stores", `${RAWG_BASE}/games/${gameId}/stores?${params}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) return [];

  const data = await res.json() as { results: RawgStoreLink[] };
  return data.results ?? [];
}

/* ───────── Curated Lists ───────── */

/** RAWG curated list item (from /games/lists/* endpoints) */
export interface RawgListItem {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  tba: boolean;
  background_image: string | null;
  rating: number;
  rating_top: number;
  ratings_count: number;
  added: number;
  added_by_status: {
    yet?: number;
    owned?: number;
    beaten?: number;
    toplay?: number;
    dropped?: number;
    playing?: number;
  };
  metacritic: number | null;
  playtime: number;
  platforms: { platform: { id: number; name: string; slug: string } }[] | null;
  genres: { id: number; name: string; slug: string }[] | null;
  short_screenshots: { id: number; image: string }[] | null;
  clip: { video: string; preview: string } | null;
  tags: { id: number; name: string; slug: string }[] | null;
  esrb_rating: { id: number; name: string; slug: string } | null;
}

export interface RawgListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: RawgListItem[];
}

/**
 * Fetch RAWG "Best of the Year" (most anticipated/popular games of current year).
 * Ordered by community adds — a proxy for real-world hype/interest.
 */
export async function getRawgBestOfYear(page = 1, pageSize = 20): Promise<RawgListResponse> {
  const params = new URLSearchParams({
    key: getApiKey(),
    discover: "true",
    ordering: "-added",
    page: String(page),
    page_size: String(pageSize),
  });

  const res = await trackedFetch("lists/greatest", `${RAWG_BASE}/games/lists/greatest?${params}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`RAWG Best of Year failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch RAWG "Popular in {year}" — top games from a specific year.
 */
export async function getRawgPopularInYear(year: number, page = 1, pageSize = 20): Promise<RawgListResponse> {
  const params = new URLSearchParams({
    key: getApiKey(),
    discover: "true",
    ordering: "-added",
    year: String(year),
    page: String(page),
    page_size: String(pageSize),
  });

  const res = await trackedFetch("lists/popular-year", `${RAWG_BASE}/games/lists/greatest?${params}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`RAWG Popular in ${year} failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch RAWG "All Time Top 250" — greatest games ever by community consensus.
 */
export async function getRawgAllTimeTop(page = 1, pageSize = 20): Promise<RawgListResponse> {
  const params = new URLSearchParams({
    key: getApiKey(),
    discover: "true",
    page: String(page),
    page_size: String(pageSize),
  });

  const res = await trackedFetch("lists/popular", `${RAWG_BASE}/games/lists/popular?${params}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`RAWG All Time Top failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch RAWG "Recent Releases" — new games from the past 30 days, ordered by popularity.
 */
export async function getRawgRecentReleases(page = 1, pageSize = 20): Promise<RawgListResponse> {
  const params = new URLSearchParams({
    key: getApiKey(),
    discover: "true",
    ordering: "-added",
    page: String(page),
    page_size: String(pageSize),
  });

  const res = await trackedFetch("lists/recent", `${RAWG_BASE}/games/lists/recent-games-past?${params}`, {
    next: { revalidate: 1800 },
  });

  if (!res.ok) throw new Error(`RAWG Recent Releases failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch RAWG release calendar for a specific month.
 */
export async function getRawgCalendar(year: number, month: number, page = 1, pageSize = 20): Promise<RawgListResponse> {
  const params = new URLSearchParams({
    key: getApiKey(),
    ordering: "-released",
    popular: "true",
    page: String(page),
    page_size: String(pageSize),
  });

  const res = await trackedFetch("calendar", `${RAWG_BASE}/games/calendar/${year}/${month}?${params}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`RAWG Calendar failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch RAWG games by genre with community sorting.
 */
export async function getRawgByGenre(genreSlug: string, page = 1, pageSize = 20): Promise<RawgListResponse> {
  const params = new URLSearchParams({
    key: getApiKey(),
    genres: genreSlug,
    ordering: "-added",
    page: String(page),
    page_size: String(pageSize),
  });

  const res = await trackedFetch("genre", `${RAWG_BASE}/games?${params}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`RAWG genre browse failed: ${res.status}`);
  return res.json();
}

/* ───────── Helpers ───────── */

/**
 * Extract the Steam App ID from RAWG store links.
 * Uses the dedicated store links (from /games/{id}/stores) which have actual URLs,
 * falling back to the game detail stores field.
 */
export function extractSteamAppId(
  stores: RawgSearchResult["stores"],
  storeLinks?: RawgStoreLink[]
): number | null {
  // Try dedicated store links first (these have real URLs)
  if (storeLinks?.length) {
    // Steam store_id is 1 in RAWG
    const steamLink = storeLinks.find((s) => s.store_id === 1);
    if (steamLink?.url) {
      const match = steamLink.url.match(/store\.steampowered\.com\/app\/(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
  }

  // Fallback to game detail stores (may have empty URLs)
  if (!stores) return null;

  const steamStore = stores.find(
    (s) => s.store.slug === "steam" || s.store.name.toLowerCase() === "steam"
  );

  if (!steamStore?.url) return null;

  const match = steamStore.url.match(/store\.steampowered\.com\/app\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract the Google Play Store URL from RAWG store links.
 */
export function extractPlayStoreUrl(
  stores: RawgSearchResult["stores"],
  storeLinks?: RawgStoreLink[]
): string | null {
  // Try dedicated store links first
  if (storeLinks?.length) {
    // Google Play store_id is 8 in RAWG
    const playLink = storeLinks.find((s) => s.store_id === 8);
    if (playLink?.url) return playLink.url;
  }

  if (!stores) return null;

  const playStore = stores.find(
    (s) =>
      s.store.slug === "google-play" ||
      s.store.name.toLowerCase().includes("google play")
  );

  return playStore?.url ?? null;
}

/**
 * Map RAWG platforms to our internal platform types.
 */
export function mapRawgPlatforms(
  platforms: RawgSearchResult["platforms"]
): string[] {
  if (!platforms) return [];

  const mapped: string[] = [];
  const add = (p: string) => { if (!mapped.includes(p)) mapped.push(p); };

  for (const { platform } of platforms) {
    const slug = platform.slug.toLowerCase();
    const name = platform.name.toLowerCase();

    if (slug === "pc") add("PC");
    else if (slug === "linux") add("Linux");
    else if (slug === "macos" || slug === "macintosh") add("macOS");
    else if (slug === "playstation5" || name.includes("playstation 5")) add("PlayStation 5");
    else if (slug === "playstation4" || name.includes("playstation 4")) add("PlayStation 4");
    else if (slug === "xbox-series-x" || name.includes("xbox series")) add("Xbox Series X|S");
    else if (slug === "xbox-one" || name.includes("xbox one")) add("Xbox One");
    else if (slug === "nintendo-switch" || name.includes("nintendo switch")) add("Nintendo Switch");
    else if (slug === "android") add("Android");
    else if (slug === "ios") add("iOS");
  }

  return mapped;
}
