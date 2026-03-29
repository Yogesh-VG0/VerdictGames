/**
 * VERDICT.GAMES — Public Safety Filters
 *
 * Shared filters to block adult/NSFW content from all public API surfaces.
 * This is the first line of defense — applied at response time so the live
 * site stops leaking bad entries even before DB cleanup finishes.
 */

/**
 * Tags that indicate adult/NSFW content.
 * Matched case-insensitively against game tags, genres, and description.
 */
const ADULT_TAGS = new Set([
  "sexual content",
  "nsfw",
  "hentai",
  "adult",
  "erotic",
  "nudity",
  "mature-content",
  "sex",
  "porn",
  "mature",
  "adult only",
  "18+",
]);

/**
 * Additional keywords to check in descriptions (broader net).
 * These are checked as substrings, not exact matches.
 */
const ADULT_DESCRIPTION_KEYWORDS = [
  "sexual content",
  "nsfw",
  "hentai",
  "erotic",
  "adult-only",
  "explicit sex",
];

/**
 * Check if a game is safe for public display.
 *
 * Returns false if the game has adult/NSFW tags or description markers.
 * This is a synchronous check designed for response-time filtering.
 */
export function isPublicSafeGame(row: {
  tags?: string[] | null;
  genres?: string[] | null;
  description?: string | null;
}): boolean {
  // Check tags
  const allTags = [
    ...(row.tags ?? []).map((t) => t.toLowerCase().trim()),
    ...(row.genres ?? []).map((g) => g.toLowerCase().trim()),
  ];

  for (const tag of allTags) {
    if (ADULT_TAGS.has(tag)) return false;
    // Also check partial matches for compound tags like "adult content"
    for (const adultTag of ADULT_TAGS) {
      if (tag.includes(adultTag)) return false;
    }
  }

  // Check description for explicit content markers
  const desc = (row.description ?? "").toLowerCase();
  for (const keyword of ADULT_DESCRIPTION_KEYWORDS) {
    if (desc.includes(keyword)) return false;
  }

  return true;
}

/**
 * Filter an array of game rows for public safety.
 * Convenience wrapper for array filtering.
 */
export function filterPublicSafeGames<T extends {
  tags?: string[] | null;
  genres?: string[] | null;
  description?: string | null;
}>(rows: T[]): T[] {
  return rows.filter(isPublicSafeGame);
}

/**
 * Check if a RAWG game result is safe for public display.
 * RAWG uses a different tag structure (array of {name, slug} objects).
 */
export function isPublicSafeRawgGame(item: {
  tags?: Array<{ name?: string; slug?: string }> | null;
  genres?: Array<{ name?: string; slug?: string }> | null;
}): boolean {
  const allTags = [
    ...(item.tags ?? []).map((t) => (t.name ?? t.slug ?? "").toLowerCase().trim()),
    ...(item.genres ?? []).map((g) => (g.name ?? g.slug ?? "").toLowerCase().trim()),
  ];

  for (const tag of allTags) {
    if (ADULT_TAGS.has(tag)) return false;
    for (const adultTag of ADULT_TAGS) {
      if (tag.includes(adultTag)) return false;
    }
  }

  return true;
}
