/**
 * VERDICT.GAMES — Apple App Store Integration
 *
 * Uses Apple's official iTunes Search/Lookup API for iOS game verification.
 * Server-only — never import in client code.
 *
 * API docs: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
 * Rate limit: ~20 calls/minute (Apple's recommendation)
 *
 * This is an enrichment layer, not a primary data source.
 * Results are stored in mobile_store_listings and used to verify
 * iOS platform availability.
 */

const ITUNES_SEARCH_BASE = "https://itunes.apple.com/search";
const ITUNES_LOOKUP_BASE = "https://itunes.apple.com/lookup";

/* ───────── Types ───────── */

export interface AppStoreResult {
  trackId: number;
  bundleId: string;
  trackName: string;
  artistName: string;          // developer
  artworkUrl100: string;       // icon (100x100)
  artworkUrl512: string;       // icon (512x512)
  screenshotUrls: string[];
  ipadScreenshotUrls: string[];
  averageUserRating: number | null;
  userRatingCount: number;
  price: number;
  currency: string;
  formattedPrice: string;
  trackViewUrl: string;        // App Store link
  primaryGenreName: string;
  genres: string[];
  contentAdvisoryRating: string;
  version: string;
  releaseDate: string;
  currentVersionReleaseDate: string;
  description: string;
  sellerName: string;
  fileSizeBytes: string;
  minimumOsVersion: string;
}

/* ───────── Search ───────── */

/**
 * Search the App Store for iOS games by title.
 * Uses Apple's official Search API — no scraping needed.
 */
export async function searchAppStore(
  term: string,
  limit = 5,
  country = "us"
): Promise<AppStoreResult[]> {
  try {
    const params = new URLSearchParams({
      term,
      entity: "software",
      media: "software",
      country,
      limit: String(limit),
    });

    const res = await fetch(`${ITUNES_SEARCH_BASE}?${params}`, {
      headers: { "User-Agent": "VerdictGames/1.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`[appstore] search returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    const results = (data.results ?? []) as Record<string, unknown>[];

    // Filter to games only (genreId 6014 = Games)
    return results
      .filter((r) => {
        const genres = r.genreIds as string[] | undefined;
        const name = (r.trackName as string) ?? "";
        // Accept if in Games category OR if the search was specific enough
        return genres?.includes("6014") || name.toLowerCase().includes(term.toLowerCase().split(" ")[0]);
      })
      .map(mapResult);
  } catch (err) {
    console.warn("[appstore] search failed:", (err as Error).message);
    return [];
  }
}

/* ───────── Lookup by ID ───────── */

/**
 * Look up an App Store app by its numeric track ID.
 */
export async function lookupAppStoreById(
  trackId: number,
  country = "us"
): Promise<AppStoreResult | null> {
  try {
    const params = new URLSearchParams({
      id: String(trackId),
      country,
      entity: "software",
    });

    const res = await fetch(`${ITUNES_LOOKUP_BASE}?${params}`, {
      headers: { "User-Agent": "VerdictGames/1.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const results = (data.results ?? []) as Record<string, unknown>[];
    return results.length > 0 ? mapResult(results[0]) : null;
  } catch (err) {
    console.warn(`[appstore] lookup(${trackId}) failed:`, (err as Error).message);
    return null;
  }
}

/**
 * Look up an App Store app by its bundle ID.
 */
export async function lookupAppStoreByBundleId(
  bundleId: string,
  country = "us"
): Promise<AppStoreResult | null> {
  try {
    const params = new URLSearchParams({
      bundleId,
      country,
      entity: "software",
    });

    const res = await fetch(`${ITUNES_LOOKUP_BASE}?${params}`, {
      headers: { "User-Agent": "VerdictGames/1.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const results = (data.results ?? []) as Record<string, unknown>[];
    return results.length > 0 ? mapResult(results[0]) : null;
  } catch (err) {
    console.warn(`[appstore] lookupBundle(${bundleId}) failed:`, (err as Error).message);
    return null;
  }
}

/* ───────── Helpers ───────── */

function mapResult(r: Record<string, unknown>): AppStoreResult {
  return {
    trackId: r.trackId as number,
    bundleId: (r.bundleId as string) ?? "",
    trackName: (r.trackName as string) ?? "",
    artistName: (r.artistName as string) ?? "",
    artworkUrl100: (r.artworkUrl100 as string) ?? "",
    artworkUrl512: (r.artworkUrl512 as string) ?? (r.artworkUrl100 as string) ?? "",
    screenshotUrls: (r.screenshotUrls as string[]) ?? [],
    ipadScreenshotUrls: (r.ipadScreenshotUrls as string[]) ?? [],
    averageUserRating: (r.averageUserRating as number) ?? null,
    userRatingCount: (r.userRatingCount as number) ?? 0,
    price: (r.price as number) ?? 0,
    currency: (r.currency as string) ?? "USD",
    formattedPrice: (r.formattedPrice as string) ?? "",
    trackViewUrl: (r.trackViewUrl as string) ?? "",
    primaryGenreName: (r.primaryGenreName as string) ?? "",
    genres: (r.genres as string[]) ?? [],
    contentAdvisoryRating: (r.contentAdvisoryRating as string) ?? "",
    version: (r.version as string) ?? "",
    releaseDate: (r.releaseDate as string) ?? "",
    currentVersionReleaseDate: (r.currentVersionReleaseDate as string) ?? "",
    description: (r.description as string) ?? "",
    sellerName: (r.sellerName as string) ?? "",
    fileSizeBytes: (r.fileSizeBytes as string) ?? "0",
    minimumOsVersion: (r.minimumOsVersion as string) ?? "",
  };
}

/**
 * Extract App Store track ID from an App Store URL.
 * e.g. "https://apps.apple.com/us/app/stardew-valley/id1406710800" → 1406710800
 */
export function extractAppStoreTrackId(url: string): number | null {
  if (!url) return null;
  const match = url.match(/\/id(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
