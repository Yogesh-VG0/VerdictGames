/**
 * VERDICT.GAMES — Media Readiness Checks
 *
 * Validates that game media (cover images, headers) are usable for display.
 * This catches broken URLs that pass the basic "truthy" check in isSurfaceReady().
 *
 * Two-layer approach:
 * 1. Synchronous check (hasUsableCardImage) — for response-time filtering
 * 2. Async validation (validateImageUrl) — for ingest/repair pipelines
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

/**
 * Validate a Steam library cover URL specifically.
 * Returns the URL if valid, null if 404 or error.
 */
export async function validateSteamCover(steamAppId: number): Promise<string | null> {
  const url = `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppId}/library_600x900_2x.jpg`;

  const isValid = await validateImageUrl(url);
  return isValid ? url : null;
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
