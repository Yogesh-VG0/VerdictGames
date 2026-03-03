/**
 * VERDICT.GAMES — RAWG API Integration
 *
 * Fetches game metadata from RAWG.io.
 * Server-only — never import in client code.
 *
 * Docs: https://rawg.io/apidocs
 */

const RAWG_BASE = "https://api.rawg.io/api";

function getApiKey(): string {
  const key = process.env.RAWG_API_KEY;
  if (!key) throw new Error("Missing RAWG_API_KEY environment variable.");
  return key;
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

  const res = await fetch(`${RAWG_BASE}/games?${params}`, {
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

  const res = await fetch(`${RAWG_BASE}/games/${id}?${params}`, {
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

  const res = await fetch(`${RAWG_BASE}/games/${id}/screenshots?${params}`, {
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

  const res = await fetch(`${RAWG_BASE}/games/${gameId}/stores?${params}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) return [];

  const data = await res.json() as { results: RawgStoreLink[] };
  return data.results ?? [];
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
  for (const { platform } of platforms) {
    const name = platform.slug.toLowerCase();
    if (name === "pc" || name === "linux" || name === "macos") {
      if (!mapped.includes("PC")) mapped.push("PC");
    } else if (name === "android") {
      if (!mapped.includes("Android")) mapped.push("Android");
    }
    // We only track PC and Android for now
  }

  return mapped;
}
