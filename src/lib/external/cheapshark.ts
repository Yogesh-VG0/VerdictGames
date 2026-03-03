/**
 * VERDICT.GAMES — CheapShark API Integration
 *
 * Free deals & price comparison API. No key required.
 * Docs: https://apidocs.cheapshark.com/
 *
 * Server-only — never import in client code.
 */

const CHEAPSHARK_BASE = "https://www.cheapshark.com/api/1.0";

/* ───────── Response Types ───────── */

export interface CheapSharkDeal {
  internalName: string;
  title: string;
  metacriticLink: string;
  dealID: string;
  storeID: string;
  gameID: string;
  salePrice: string;        // "14.99"
  normalPrice: string;      // "29.99"
  isOnSale: "0" | "1";
  savings: string;           // "50.000000" (percentage)
  metacriticScore: string;   // "92"
  steamRatingText: string;   // "Very Positive"
  steamRatingPercent: string; // "95"
  steamRatingCount: string;
  steamAppID: string | null;
  releaseDate: number;        // epoch timestamp
  lastChange: number;         // epoch timestamp
  dealRating: string;         // "9.5"
  thumb: string;              // thumbnail URL
}

export interface CheapSharkGameInfo {
  info: {
    title: string;
    steamAppID: string | null;
    thumb: string;
  };
  cheapestPriceEver: {
    price: string;        // "4.99"
    date: number;         // epoch timestamp
  };
  deals: {
    storeID: string;
    dealID: string;
    price: string;
    retailPrice: string;
    savings: string;
  }[];
}

export interface CheapSharkSearchResult {
  gameID: string;
  steamAppID: string | null;
  cheapest: string;          // cheapest price as string
  cheapestDealID: string;
  external: string;          // game title
  internalName: string;
  thumb: string;
}

/** Store name mapping for CheapShark store IDs */
const STORE_MAP: Record<string, string> = {
  "1": "Steam",
  "2": "GamersGate",
  "3": "GreenManGaming",
  "7": "GOG",
  "8": "Origin",
  "11": "Humble Store",
  "13": "Uplay",
  "15": "Fanatical",
  "21": "WinGameStore",
  "23": "GameBillet",
  "24": "Voidu",
  "25": "Epic Games Store",
  "27": "Gamesplanet",
  "28": "Gamesload",
  "29": "2Game",
  "30": "IndieGala",
  "31": "Blizzard Shop",
  "33": "DLGamer",
  "34": "Noctre",
  "35": "DreamGame",
};

/* ───────── API Functions ───────── */

/**
 * Search CheapShark for a game by title.
 * Returns matching games with their cheapest known price.
 */
export async function searchCheapShark(
  title: string,
  limit = 5
): Promise<CheapSharkSearchResult[]> {
  try {
    const params = new URLSearchParams({
      title,
      limit: String(limit),
      exact: "0",
    });

    const res = await fetch(`${CHEAPSHARK_BASE}/games?${params}`, {
      next: { revalidate: 1800 },
    });

    if (!res.ok) return [];

    const data: CheapSharkSearchResult[] = await res.json();
    return data ?? [];
  } catch (err) {
    console.error(`[CheapShark] Search failed for "${title}":`, err);
    return [];
  }
}

/**
 * Get detailed game info from CheapShark, including all current deals
 * and the cheapest price ever recorded.
 */
export async function getCheapSharkGame(
  gameId: string
): Promise<CheapSharkGameInfo | null> {
  try {
    const res = await fetch(`${CHEAPSHARK_BASE}/games?id=${gameId}`, {
      next: { revalidate: 1800 },
    });

    if (!res.ok) return null;

    const data: CheapSharkGameInfo = await res.json();
    return data;
  } catch (err) {
    console.error(`[CheapShark] Game fetch failed for ID ${gameId}:`, err);
    return null;
  }
}

/**
 * Get current deals, optionally filtered by Steam App ID.
 * Returns top deals sorted by deal rating.
 */
export async function getCheapSharkDeals(options?: {
  steamAppId?: number;
  storeId?: string;
  pageNumber?: number;
  pageSize?: number;
  sortBy?: "Deal Rating" | "Title" | "Savings" | "Price" | "Metacritic" | "Reviews" | "Release" | "Store" | "Recent";
}): Promise<CheapSharkDeal[]> {
  try {
    const params = new URLSearchParams({
      pageNumber: String(options?.pageNumber ?? 0),
      pageSize: String(options?.pageSize ?? 20),
      sortBy: options?.sortBy ?? "Deal Rating",
    });

    if (options?.steamAppId) {
      params.set("steamAppID", String(options.steamAppId));
    }
    if (options?.storeId) {
      params.set("storeID", options.storeId);
    }

    const res = await fetch(`${CHEAPSHARK_BASE}/deals?${params}`, {
      next: { revalidate: 1800 },
    });

    if (!res.ok) return [];

    const data: CheapSharkDeal[] = await res.json();
    return data ?? [];
  } catch (err) {
    console.error("[CheapShark] Deals fetch failed:", err);
    return [];
  }
}

/**
 * Find the best CheapShark match for a game and extract deal data.
 * Used during ingestion to enrich games with pricing info.
 */
export async function findCheapSharkDeal(
  title: string,
  steamAppId?: number | null
): Promise<{
  cheapsharkId: string | null;
  priceCurrent: number | null;   // cents
  priceLowest: number | null;    // cents
  priceDealUrl: string | null;
  isFree: boolean;
} | null> {
  try {
    // If we have a Steam App ID, try to find deals directly
    if (steamAppId) {
      const deals = await getCheapSharkDeals({ steamAppId });
      if (deals.length > 0) {
        const bestDeal = deals[0];
        const gameResults = await searchCheapShark(title, 1);
        const cheapsharkId = gameResults[0]?.gameID ?? bestDeal.gameID;

        // Fetch cheapest-ever price
        let priceLowest: number | null = null;
        if (cheapsharkId) {
          const gameInfo = await getCheapSharkGame(cheapsharkId);
          if (gameInfo?.cheapestPriceEver) {
            priceLowest = dollarsToCents(gameInfo.cheapestPriceEver.price);
          }
        }

        return {
          cheapsharkId,
          priceCurrent: dollarsToCents(bestDeal.salePrice),
          priceLowest,
          priceDealUrl: `https://www.cheapshark.com/redirect?dealID=${bestDeal.dealID}`,
          isFree: bestDeal.salePrice === "0.00",
        };
      }
    }

    // Fallback: search by title
    const results = await searchCheapShark(title, 3);
    if (!results.length) return null;

    // Find best match — prefer one with matching Steam App ID
    let best = results[0];
    if (steamAppId) {
      const steamMatch = results.find((r) => r.steamAppID === String(steamAppId));
      if (steamMatch) best = steamMatch;
    }

    // Get full game info for cheapest-ever price
    const gameInfo = await getCheapSharkGame(best.gameID);
    const priceLowest = gameInfo?.cheapestPriceEver
      ? dollarsToCents(gameInfo.cheapestPriceEver.price)
      : null;

    // Get current best deal
    const currentPrice = dollarsToCents(best.cheapest);

    return {
      cheapsharkId: best.gameID,
      priceCurrent: currentPrice,
      priceLowest,
      priceDealUrl: best.cheapestDealID
        ? `https://www.cheapshark.com/redirect?dealID=${best.cheapestDealID}`
        : null,
      isFree: best.cheapest === "0.00",
    };
  } catch (err) {
    console.error(`[CheapShark] findCheapSharkDeal failed for "${title}":`, err);
    return null;
  }
}

/* ───────── Helpers ───────── */

/** Convert a dollar string like "14.99" to cents (1499). */
function dollarsToCents(price: string): number {
  return Math.round(parseFloat(price) * 100);
}

/** Get the store name for a CheapShark store ID. */
export function getStoreName(storeId: string): string {
  return STORE_MAP[storeId] ?? `Store #${storeId}`;
}

/** Build a CheapShark deal redirect URL. */
export function cheapSharkDealUrl(dealId: string): string {
  return `https://www.cheapshark.com/redirect?dealID=${dealId}`;
}
