/**
 * VERDICT.GAMES — Platform Normalization (server-safe)
 *
 * Single source of truth for canonical platform names.
 * Use normalizePlatform() on every ingest path (RAWG, IGDB, GX, admin)
 * to ensure consistent platform values in the database and UI.
 */

import type { Platform } from "../types";

/** All canonical platform values recognized by the system. */
export const CANONICAL_PLATFORMS: Platform[] = [
  "PC",
  "PlayStation 5",
  "PlayStation 4",
  "Xbox Series X|S",
  "Xbox One",
  "Nintendo Switch",
  "Nintendo Switch 2",
  "Android",
  "iOS",
  "macOS",
  "Linux",
];

/**
 * Map of known raw platform strings → canonical Platform value.
 * Covers IGDB, RAWG, GX, and common variations.
 */
const PLATFORM_ALIAS_MAP: Record<string, Platform> = {
  // PC variants
  "pc": "PC",
  "pc (microsoft windows)": "PC",
  "microsoft windows": "PC",
  "windows": "PC",
  "win": "PC",

  // PlayStation
  "playstation 5": "PlayStation 5",
  "ps5": "PlayStation 5",
  "playstation5": "PlayStation 5",
  "playstation 4": "PlayStation 4",
  "ps4": "PlayStation 4",
  "playstation4": "PlayStation 4",

  // Xbox
  "xbox series x|s": "Xbox Series X|S",
  "xbox series x/s": "Xbox Series X|S",
  "xbox series x": "Xbox Series X|S",
  "xbox series s": "Xbox Series X|S",
  "xbox series": "Xbox Series X|S",
  "xsx": "Xbox Series X|S",
  "xbox one": "Xbox One",
  "xb1": "Xbox One",
  "xboxone": "Xbox One",

  // Nintendo
  "nintendo switch": "Nintendo Switch",
  "switch": "Nintendo Switch",
  "nsw": "Nintendo Switch",
  "nintendo switch 2": "Nintendo Switch 2",
  "switch 2": "Nintendo Switch 2",
  "ns2": "Nintendo Switch 2",

  // Mobile
  "android": "Android",
  "ios": "iOS",
  "iphone": "iOS",
  "ipad": "iOS",

  // Desktop
  "macos": "macOS",
  "mac": "macOS",
  "apple macintosh": "macOS",
  "linux": "Linux",
  "lnx": "Linux",
};

/**
 * Normalize a raw platform string into a canonical Platform value.
 * Returns null if the platform is unrecognized.
 *
 * Usage: call on every ingest path (IGDB, RAWG, GX, admin) before storing.
 */
export function normalizePlatform(raw: string): Platform | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (PLATFORM_ALIAS_MAP[key]) return PLATFORM_ALIAS_MAP[key];

  // Fuzzy matching for partial strings
  if (key.includes("windows") || key === "pc") return "PC";
  if (key.includes("playstation 5") || key.includes("ps5")) return "PlayStation 5";
  if (key.includes("playstation 4") || key.includes("ps4")) return "PlayStation 4";
  if (key.includes("xbox series")) return "Xbox Series X|S";
  if (key.includes("xbox one")) return "Xbox One";
  if (key.includes("switch 2")) return "Nintendo Switch 2";
  if (key.includes("switch")) return "Nintendo Switch";
  if (key.includes("android")) return "Android";
  if (key.includes("ios") || key.includes("iphone") || key.includes("ipad")) return "iOS";
  if (key.includes("mac")) return "macOS";
  if (key.includes("linux")) return "Linux";

  return null;
}

/**
 * Normalize an array of raw platform strings.
 * Deduplicates and filters out unrecognized platforms.
 */
export function normalizePlatforms(rawPlatforms: string[]): Platform[] {
  const seen = new Set<Platform>();
  const result: Platform[] = [];
  for (const raw of rawPlatforms) {
    const p = normalizePlatform(raw);
    if (p && !seen.has(p)) {
      seen.add(p);
      result.push(p);
    }
  }
  return result;
}

/* ═══════════════════════════════════════════════════
   Platform Family Grouping (for compact card display)
   ═══════════════════════════════════════════════════ */

export type PlatformFamily = "PC" | "PlayStation" | "Xbox" | "Nintendo" | "Mobile" | "Desktop";

const PLATFORM_TO_FAMILY: Record<Platform, PlatformFamily> = {
  "PC": "PC",
  "PlayStation 5": "PlayStation",
  "PlayStation 4": "PlayStation",
  "Xbox Series X|S": "Xbox",
  "Xbox One": "Xbox",
  "Nintendo Switch": "Nintendo",
  "Nintendo Switch 2": "Nintendo",
  "Android": "Mobile",
  "iOS": "Mobile",
  "macOS": "Desktop",
  "Linux": "Desktop",
};

/** Representative platform to show icon for each family */
const FAMILY_REPRESENTATIVE: Record<PlatformFamily, Platform> = {
  "PC": "PC",
  "PlayStation": "PlayStation 5",
  "Xbox": "Xbox Series X|S",
  "Nintendo": "Nintendo Switch",
  "Mobile": "Android",
  "Desktop": "macOS",
};

/**
 * Collapse a list of platforms into family groups for compact display.
 * Returns representative platforms (one per family) + overflow count.
 * 
 * @param platforms Full platform list
 * @param maxVisible Maximum icons to show (default: 3)
 */
export function collapsePlatforms(
  platforms: Platform[],
  maxVisible = 3
): { visible: Platform[]; overflow: number } {
  const seenFamilies = new Set<PlatformFamily>();
  const representatives: Platform[] = [];

  for (const p of platforms) {
    const family = PLATFORM_TO_FAMILY[p];
    if (!family || seenFamilies.has(family)) continue;
    seenFamilies.add(family);
    representatives.push(FAMILY_REPRESENTATIVE[family]);
  }

  if (representatives.length <= maxVisible) {
    return { visible: representatives, overflow: 0 };
  }

  return {
    visible: representatives.slice(0, maxVisible),
    overflow: representatives.length - maxVisible,
  };
}
