/**
 * VERDICT.GAMES — Google Play Store Integration
 *
 * Uses google-play-scraper for batch enrichment of Android game data.
 * Server-only — never import in client code.
 *
 * This is an enrichment layer, not a primary data source.
 * Results are stored in mobile_store_listings and used to verify
 * Android platform availability.
 */

// google-play-scraper is ESM-only; dynamic import avoids build issues.
// We use `any` deliberately here because the library's TS types are
// incomplete and don't match the actual runtime API surface.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getGplayScraper(): Promise<any> {
  const gplay = await import("google-play-scraper");
  return gplay.default ?? gplay;
}

/* ───────── Types ───────── */

export interface GooglePlayAppResult {
  appId: string;
  title: string;
  summary?: string;
  developer: string;
  developerId?: string;
  icon: string;
  headerImage?: string;
  screenshots: string[];
  score: number | null;
  ratings: number;
  reviews: number;
  installs: string;
  minInstalls?: number;
  realInstalls?: number;
  price: number;
  free: boolean;
  currency: string;
  offersIAP: boolean;
  inAppProductPrice?: string;
  genre: string;
  genreId: string;
  contentRating?: string;
  released?: string;
  updated?: number;
  version?: string;
  url: string;
}

export interface GooglePlaySearchResult {
  appId: string;
  title: string;
  summary?: string;
  developer: string;
  icon: string;
  score: number | null;
  free: boolean;
  price: number;
  genre?: string;
  installs?: string;
  url?: string;
}

/* ───────── Search ───────── */

/**
 * Search Google Play for a game by title.
 * Returns up to `limit` results. Uses throttling to avoid bans.
 */
export async function searchGooglePlay(
  term: string,
  limit = 5
): Promise<GooglePlaySearchResult[]> {
  try {
    const gplay = await getGplayScraper();
    const results = await gplay.search({
      term,
      num: limit,
      throttle: 10,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return results.map((r: any) => ({
      appId: r.appId,
      title: r.title,
      summary: r.summary,
      developer: r.developer,
      icon: r.icon,
      score: r.score ?? null,
      free: r.free ?? true,
      price: r.price ?? 0,
      genre: r.genre,
      installs: r.installs,
      url: r.url,
    }));
  } catch (err) {
    console.warn("[googleplay] search failed:", (err as Error).message);
    return [];
  }
}

/* ───────── App Detail ───────── */

/**
 * Get full details for a Google Play app by package name.
 */
export async function getGooglePlayApp(
  appId: string,
  lang = "en",
  country = "us"
): Promise<GooglePlayAppResult | null> {
  try {
    const gplay = await getGplayScraper();
    const r = await gplay.app({ appId, lang, country });
    return {
      appId: r.appId ?? appId,
      title: r.title ?? "",
      summary: r.summary,
      developer: r.developer ?? "",
      developerId: r.developerId,
      icon: r.icon ?? "",
      headerImage: r.headerImage,
      screenshots: r.screenshots ?? [],
      score: r.score ?? null,
      ratings: r.ratings ?? 0,
      reviews: r.reviews ?? 0,
      installs: r.installs ?? "",
      minInstalls: r.minInstalls,
      realInstalls: r.maxInstalls ?? r.realInstalls,
      price: r.price ?? 0,
      free: r.free ?? true,
      currency: r.currency ?? "USD",
      offersIAP: r.offersIAP ?? false,
      inAppProductPrice: r.IAPRange ?? r.inAppProductPrice,
      genre: r.genre ?? "",
      genreId: r.genreId ?? "",
      contentRating: r.contentRating,
      released: r.released,
      updated: r.updated,
      version: r.version,
      url: r.url ?? `https://play.google.com/store/apps/details?id=${appId}`,
    };
  } catch (err) {
    console.warn(`[googleplay] getApp(${appId}) failed:`, (err as Error).message);
    return null;
  }
}

/* ───────── Browse by Category ───────── */

/**
 * Browse top games in a Google Play category.
 * Categories: GAME_ACTION, GAME_ADVENTURE, GAME_ARCADE, GAME_BOARD,
 * GAME_CARD, GAME_CASINO, GAME_CASUAL, GAME_EDUCATIONAL, GAME_MUSIC,
 * GAME_PUZZLE, GAME_RACING, GAME_ROLE_PLAYING, GAME_SIMULATION,
 * GAME_SPORTS, GAME_STRATEGY, GAME_TRIVIA, GAME_WORD
 */
export async function browseGooglePlayCategory(
  category: string,
  num = 100
): Promise<GooglePlaySearchResult[]> {
  try {
    const gplay = await getGplayScraper();
    const collection = gplay.collection?.TOP_FREE ?? "topselling_free";
    const results = await gplay.list({
      category: category as never,
      collection,
      num,
      throttle: 10,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return results.map((r: any) => ({
      appId: r.appId,
      title: r.title,
      summary: r.summary,
      developer: r.developer,
      icon: r.icon,
      score: r.score ?? null,
      free: r.free ?? true,
      price: r.price ?? 0,
      genre: r.genre,
      installs: r.installs,
      url: r.url,
    }));
  } catch (err) {
    console.warn(`[googleplay] browse(${category}) failed:`, (err as Error).message);
    return [];
  }
}

/* ───────── Game Categories ───────── */

export const GOOGLE_PLAY_GAME_CATEGORIES = [
  "GAME_ACTION",
  "GAME_ADVENTURE",
  "GAME_ARCADE",
  "GAME_BOARD",
  "GAME_CARD",
  "GAME_CASINO",
  "GAME_CASUAL",
  "GAME_EDUCATIONAL",
  "GAME_MUSIC",
  "GAME_PUZZLE",
  "GAME_RACING",
  "GAME_ROLE_PLAYING",
  "GAME_SIMULATION",
  "GAME_SPORTS",
  "GAME_STRATEGY",
  "GAME_TRIVIA",
  "GAME_WORD",
] as const;

/* ───────── Matching Helpers ───────── */

/**
 * Extract a Google Play package name from a Play Store URL.
 * e.g. "https://play.google.com/store/apps/details?id=com.supercell.clashroyale"
 *   → "com.supercell.clashroyale"
 */
export function extractPackageName(url: string): string | null {
  if (!url) return null;
  const match = url.match(/[?&]id=([a-zA-Z0-9_.]+)/);
  return match?.[1] ?? null;
}

/**
 * Normalize a title for comparison purposes.
 * Strips punctuation, lowercases, removes common suffixes.
 */
export function normalizeForMatch(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(hd|lite|free|se|remastered|enhanced edition|definitive edition|premium|deluxe|complete|goty)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculate title similarity score between two game titles.
 * Returns 0-100 where 100 is exact match.
 */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);

  if (na === nb) return 100;
  if (na.startsWith(nb) || nb.startsWith(na)) return 85;

  const tokensA = new Set(na.split(" ").filter(Boolean));
  const tokensB = new Set(nb.split(" ").filter(Boolean));
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;

  return union > 0 ? Math.round((intersection / union) * 100) : 0;
}
