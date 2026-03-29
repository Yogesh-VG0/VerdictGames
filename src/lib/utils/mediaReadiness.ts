/**
 * VERDICT.GAMES — Media Readiness Checks
 *
 * Validates that game media (cover images, headers) are usable for display.
 * This catches broken URLs that pass the basic "truthy" check in isSurfaceReady().
 *
 * Two-layer approach:
 * 1. Synchronous check (hasUsableCardImage) — for response-time filtering
 * 2. Async validation (validateImageUrl) — for ingest/repair pipelines
 *
 * GLOBAL COVER PRIORITY ORDER:
 *   1. IGDB cover (most reliable, high-quality)
 *   2. RAWG background_image (good fallback)
 *   3. Steam validated cover (last resort, unreliable)
 *   4. Keep existing trusted media or leave empty for repair
 */

/**
 * Known-problematic Steam cover URL pattern.
 * Steam's library_600x900 capsules don't exist for all games.
 */
const STEAM_LIBRARY_COVER_PATTERN = /cdn\.akamai\.steamstatic\.com\/steam\/apps\/\d+\/library_600x900/;

/**
 * Known-good image URL patterns (trusted sources that rarely 404).
 */
const TRUSTED_IMAGE_PATTERNS = [
  /media\.rawg\.io/,
  /images\.igdb\.com/,
  /upload\.wikimedia\.org/,
  /steamcdn-a\.akamaihd\.net.*header/,  // Steam headers are more reliable than library capsules
];

/**
 * Synchronous check if a game has a usable card image.
 *
 * This is a conservative gate for response-time filtering.
 * Steam library covers are flagged as potentially broken since
 * they don't exist for all games.
 *
 * For now, we accept Steam library covers but the repair script
 * will validate and fix them. After DB cleanup, we can tighten this.
 */
export function hasUsableCardImage(row: {
  cover_image?: string | null;
  header_image?: string | null;
  media_source?: string | null;
}): boolean {
  const cover = row.cover_image ?? "";
  if (!cover) return false;

  // If media_source is set, we've validated this image before
  if (row.media_source) return true;

  // Trust known-good sources
  for (const pattern of TRUSTED_IMAGE_PATTERNS) {
    if (pattern.test(cover)) return true;
  }

  // Steam library covers are unreliable but we accept them for now
  // The repair script will validate and fix broken ones
  if (STEAM_LIBRARY_COVER_PATTERN.test(cover)) {
    // Accept for now — repair script handles validation
    // TODO: After DB cleanup, consider requiring header_image as fallback
    return true;
  }

  // Accept any other non-empty URL
  return true;
}

/**
 * Check if a Steam library cover URL is the potentially unreliable type.
 * Used by repair scripts to identify URLs that need validation.
 */
export function isSteamLibraryCover(url: string): boolean {
  return STEAM_LIBRARY_COVER_PATTERN.test(url);
}

/**
 * Async validation for image URLs.
 * Use this in ingest/repair pipelines, NOT in response-time filtering.
 */
export async function validateImageUrl(url: string): Promise<boolean> {
  if (!url) return false;

  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Media source priority ranking (lower = better) */
export const MEDIA_SOURCE_PRIORITY: Record<string, number> = {
  igdb: 1,
  rawg: 2,
  steam: 3,
  unknown: 99,
};

/**
 * Get media source from URL.
 */
export function getMediaSourceFromUrl(url: string | null | undefined): string | null {
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
export function isMediaUpgrade(existingSource: string | null, newSource: string | null): boolean {
  const existingPriority = MEDIA_SOURCE_PRIORITY[existingSource ?? "unknown"] ?? 99;
  const newPriority = MEDIA_SOURCE_PRIORITY[newSource ?? "unknown"] ?? 99;
  return newPriority < existingPriority;
}

/**
 * Fetch Steam cover via GetItems API (reliable fallback).
 * Uses IStoreBrowseService/GetItems/v1 which returns proper asset paths.
 * This handles games like Elder Scrolls IV: Oblivion Remastered that have
 * non-standard asset paths.
 */
export async function fetchSteamCoverViaGetItems(
  steamAppId: number
): Promise<{ coverUrl: string; headerUrl: string | null } | null> {
  try {
    const inputJson = JSON.stringify({
      ids: [{ appid: steamAppId }],
      context: { country_code: "US" },
      data_request: { include_assets: true },
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
    const headerUrl = header
      ? `${baseUrl}/${asset_url_format.replace("${FILENAME}", header)}`
      : null;

    return { coverUrl, headerUrl };
  } catch {
    return null;
  }
}

/**
 * Validate and get Steam cover URL.
 * First tries standard CDN URL, then falls back to GetItems API.
 * Returns { coverUrl, headerUrl, source } if valid, null if not.
 *
 * NOTE: Steam covers are LAST RESORT - prefer IGDB/RAWG.
 */
export async function validateAndGetSteamCover(
  steamAppId: number
): Promise<{ coverUrl: string; headerUrl: string | null; source: string } | null> {
  // Try standard CDN URL first (faster if it exists)
  const cdnUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppId}/library_600x900_2x.jpg`;
  try {
    const res = await fetch(cdnUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      return { coverUrl: cdnUrl, headerUrl: null, source: "steam-cdn" };
    }
  } catch {
    /* continue to fallback */
  }

  // Fallback: Use GetItems API for games with non-standard asset paths
  const getItemsResult = await fetchSteamCoverViaGetItems(steamAppId);
  if (getItemsResult?.coverUrl) {
    return { ...getItemsResult, source: "steam-api" };
  }

  return null;
}

/**
 * @deprecated Use validateAndGetSteamCover instead for better reliability.
 * Validate a Steam library cover URL specifically.
 * Returns the URL if valid, null if 404 or error.
 */
export async function validateSteamCover(steamAppId: number): Promise<string | null> {
  const result = await validateAndGetSteamCover(steamAppId);
  return result?.coverUrl ?? null;
}

/**
 * Try multiple cover URL candidates in order, return first valid one.
 * Used by ingest pipeline for fallback chain.
 */
export async function findValidCoverUrl(candidates: (string | null | undefined)[]): Promise<string | null> {
  for (const url of candidates) {
    if (!url) continue;

    // Trust known-good sources without validation
    for (const pattern of TRUSTED_IMAGE_PATTERNS) {
      if (pattern.test(url)) return url;
    }

    // Validate unknown sources
    const isValid = await validateImageUrl(url);
    if (isValid) return url;
  }

  return null;
}
