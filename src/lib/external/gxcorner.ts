/**
 * VERDICT.GAMES — GX Corner API Client
 *
 * Wraps all 8 GX Corner public API feeds. No API key required.
 * All endpoints are CORS-enabled and return JSON directly.
 *
 * Server-only — called from /api/gx/* proxy routes.
 */

const BASE = "https://proxy.gxcorner.games";
const NEWS_BASE = "https://api.news.gxcorner.games";
const PARAMS = "LANG=en&COUNTRY=US&LOCALE=en-US";

const SECTION_IDS = {
  gamesFeed: "66169a28-8aa3-4faf-b4b1-37fe2e9c2696",
  calendar: "rnvh1hw83hx7oihefovrha1k",
  freeToPlay: "epxf2hi25u6xj0zuvkwplr3n",
  topGames: "ywob9o16h7og5bpmd8w2ds4f",
  superDeals: "u4j90h55yeehpmjwfqlw28bt",
  topLiked: "vo6idyvuegqvjyeu4lrdwdgx",
};

/* ───────── Types ───────── */

export interface GXGenre {
  id: number;
  name: string;
  key: string;
}

export interface GXPlatform {
  id: number;
  name: string;
  icon?: { id: number; url: string; isUrlSigned?: boolean };
  key?: string | null;
}

export interface GXStore {
  id: number;
  name: string;
  key: string;
  color: string;
  icon?: { id: number; url: string };
}

export interface GXPrice {
  url: string;
  price: number | null;
  discount: number | null;
  countries: string[] | null;
  currency: { id: number; abbr: string } | null;
  store?: GXStore | null;
}

export interface GXGameDetail {
  id: number;
  title: string;
  slug: string | null;
  website: string;
  releaseDate: string | null;
  rating: number | null;
  imageCoverVertical: { url: string } | null;
  imageCoverSquare: { url: string } | null;
  imageCoverHorizontal: { url: string } | null;
  screenshots: { id: number; url: string }[];
  videoPreview: string | null;
  trailers: { trailer: { url: string; title: string; thumbnail: string } }[];
  prices: GXPrice[];
  genres: GXGenre[];
  platforms: GXPlatform[];
}

export interface GXHighlight {
  id: string | number;
  title: string;
  description: string | null;
  backgroundImage: string | null;
  trailer: { trailer: { url: string; title: string; thumbnail: string } } | null;
  useTrailer: boolean;
  tag: { id: number; name: string; color: string | null } | null;
  genres: GXGenre[];
  platforms: GXPlatform[];
  prices: GXPrice[];
  isMod: boolean;
  videoPreview: string | null;
  videoPreviewMode: "autoplay" | null;
  position: number;
  cursorText: string | null;
  itemType: string;
  store: GXStore | null;
  dealType: string | null;
  url: string | null;
  sectionKey: string;
}

export interface GXCalendarEntry {
  id: number | null;
  url: string | null;
  release: string;
  hotGame: boolean | null;
  onlyMobile: boolean | null;
  platforms: GXPlatform[];
  cta: { id: number; label: string } | null;
  tag: { id: number; name: string; color: string | null } | null;
  hideCta: boolean | null;
  game: GXGameDetail;
}

export interface GXGameListEntry {
  id: string;
  url: string | null;
  platforms: GXPlatform[];
  publishedAt: string | null;
  order: number;
  game: GXGameDetail;
  tag: { id: number; name: string; color: string | null } | null;
  subTag: { id: number; name: string } | null;
  store: GXStore | null;
  cta: { id: number; label: string };
  dealType: string | null;
}

export interface GXDealEntry {
  id: string;
  dealType: "percentage" | "bundle" | null;
  tag: { id: number; name: string; color: string | null } | null;
  store: GXStore | null;
  game: GXGameDetail;
  cta: { id: number; label: string };
  url: string | null;
}

export interface GXTopLikedGame {
  id: string;
  title: string;
  slug: string;
  url: string;
  releaseDate: string | null;
  imageSrc: string;
  genres: GXGenre[];
  likesCount: number;
}

export interface GXNewsArticle {
  article_id: number;
  display_url: string;
  real_url: string;
  image: string;
  publisher_domain: string;
  publisher_favicon: string;
  publisher_name: string;
  size: [number, number];
  title: string;
  related?: { name: string; url: string; icon: string }[];
}

/* ───────── Internal fetcher ───────── */

async function gxFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`GX API ${res.status}: ${url}`);
  return res.json();
}

/* ───────── Public API ───────── */

/** API 2 — Hero carousel highlights */
export async function getGXHighlights(): Promise<GXHighlight[]> {
  try {
    const data = await gxFetch<{ data: { sectionType: [{ highlights: GXHighlight[] }] } }>(
      `${BASE}/desktop/highlights/us/en?version=desktop&${PARAMS}`
    );
    return data.data.sectionType[0].highlights;
  } catch (err) {
    console.warn("[GX] highlights fetch failed:", err);
    return [];
  }
}

/** API 3 — Release calendar */
export async function getGXCalendar(): Promise<GXCalendarEntry[]> {
  try {
    const data = await gxFetch<{ data: { sectionType: [{ games: GXCalendarEntry[] }] } }>(
      `${BASE}/new-content/corners/desktop/calendar/${SECTION_IDS.calendar}/us/en?${PARAMS}`
    );
    return data.data.sectionType[0].games;
  } catch (err) {
    console.warn("[GX] calendar fetch failed:", err);
    return [];
  }
}

/** API 4 — Free-to-play games */
export async function getGXFreeToPlay(): Promise<GXGameListEntry[]> {
  try {
    const data = await gxFetch<{ data: { sectionType: [{ games: GXGameListEntry[] }] } }>(
      `${BASE}/new-content/corners/free-to-plays/${SECTION_IDS.freeToPlay}/us/en?version=desktop&${PARAMS}`
    );
    return data.data.sectionType[0].games.sort((a, b) => a.order - b.order);
  } catch (err) {
    console.warn("[GX] free-to-play fetch failed:", err);
    return [];
  }
}

/** API 5 — Top games (PS Plus, Game Pass, etc.) */
export async function getGXTopGames(): Promise<GXGameListEntry[]> {
  try {
    const data = await gxFetch<{ data: { sectionType: [{ games: GXGameListEntry[] }] } }>(
      `${BASE}/new-content/corners/top-games/${SECTION_IDS.topGames}/us/en?version=desktop&${PARAMS}`
    );
    return data.data.sectionType[0].games;
  } catch (err) {
    console.warn("[GX] top games fetch failed:", err);
    return [];
  }
}

/** API 6 — Super deals / discounts */
export async function getGXDeals(): Promise<GXDealEntry[]> {
  try {
    const data = await gxFetch<{ data: { sectionType: [{ games: GXDealEntry[] }] } }>(
      `${BASE}/new-content/corners/super-deals/${SECTION_IDS.superDeals}/us/en?${PARAMS}`
    );
    return data.data.sectionType[0].games;
  } catch (err) {
    console.warn("[GX] deals fetch failed:", err);
    return [];
  }
}

/** API 7 — Most liked / most anticipated. Falls back to RAWG trending if GX fails. */
export async function getGXTopLiked(): Promise<GXTopLikedGame[]> {
  try {
    const data = await gxFetch<{ data: { sectionType: [{ games: GXTopLikedGame[] }] } }>(
      `${BASE}/new-content/corners/top-liked-games/${SECTION_IDS.topLiked}/us/en?${PARAMS}`
    );
    return data.data.sectionType[0].games;
  } catch (err) {
    console.warn("[GX] top liked fetch failed, trying RAWG fallback:", err);
    return getTopLikedFallback();
  }
}

async function getTopLikedFallback(): Promise<GXTopLikedGame[]> {
  try {
    const key = process.env.RAWG_API_KEY;
    if (!key) return [];
    const res = await fetch(
      `https://api.rawg.io/api/games?key=${key}&ordering=-added&page_size=10&dates=${(() => {
        const now = new Date();
        const from = new Date(now); from.setDate(from.getDate() - 90);
        return `${from.toISOString().slice(0, 10)},${now.toISOString().slice(0, 10)}`;
      })()}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results ?? []).map((g: { id: number; name: string; slug: string; background_image: string | null; released: string | null; genres: { name: string; key: string }[]; ratings_count: number }) => ({
      id: String(g.id),
      title: g.name,
      slug: g.slug,
      url: `https://rawg.io/games/${g.slug}`,
      releaseDate: g.released,
      imageSrc: g.background_image ?? "",
      genres: (g.genres ?? []).map((ge) => ({ id: 0, name: ge.name, key: ge.key })),
      likesCount: g.ratings_count ?? 0,
    }));
  } catch {
    return [];
  }
}

/** API 8a — Popular / trending news */
export async function getGXPopularNews(): Promise<GXNewsArticle[]> {
  try {
    const params = new URLSearchParams({
      country: "us",
      language: "en-US",
      category: "ga,te",
      timezone: "+00:00",
      LANG: "en",
      COUNTRY: "US",
      LOCALE: "en-US",
    });
    return await gxFetch<GXNewsArticle[]>(`${NEWS_BASE}/news/popular?${params}`);
  } catch (err) {
    console.warn("[GX] popular news fetch failed:", err);
    return [];
  }
}

/** API 8b — Full news feed */
export async function getGXNewsFeed(): Promise<GXNewsArticle[]> {
  try {
    const params = new URLSearchParams({
      country: "us",
      language: "en-US",
      category: "ga,te",
      timezone: "+00:00",
      LANG: "en",
      COUNTRY: "US",
      LOCALE: "en-US",
    });
    const data = await gxFetch<{ news: GXNewsArticle[] }>(`${NEWS_BASE}/news?${params}`);
    return data.news;
  } catch (err) {
    console.warn("[GX] news feed fetch failed:", err);
    return [];
  }
}
