import type { GXCalendarEntry } from "@/lib/external/gxcorner";
import type { Game, GXCalendarGame, Platform } from "@/lib/types";
import { slugify } from "@/lib/utils/slugify";

export function getCalendarMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function isValidCalendarMonthKey(month: string): boolean {
  return /^\d{4}-\d{2}$/.test(month);
}

export function resolveCalendarMonthKey(month?: string | null): string | null {
  if (!month) return getCalendarMonthKey();
  return isValidCalendarMonthKey(month) ? month : null;
}

export function isPastCalendarMonth(month: string, date = new Date()): boolean {
  return month < getCalendarMonthKey(date);
}

function mapGXPlatformName(platform: string): Platform | null {
  const value = platform.toLowerCase();
  if (value.includes("windows") || value === "pc") return "PC";
  if (value.includes("playstation") || value === "ps5") return "PlayStation 5";
  if (value.includes("xbox")) return "Xbox Series X|S";
  if (value.includes("switch")) return "Nintendo Switch";
  if (value.includes("android")) return "Android";
  if (value.includes("ios")) return "iOS";
  if (value.includes("mac")) return "macOS";
  if (value.includes("linux")) return "Linux";
  return null;
}

export function mapGXCalendarEntry(entry: GXCalendarEntry): GXCalendarGame {
  return {
    title: entry.game.title,
    slug: entry.game.slug,
    cover: entry.game.imageCoverVertical?.url ?? null,
    releaseDate: entry.release,
    hotGame: entry.hotGame ?? false,
    url: entry.url,
    ctaLabel: entry.cta?.label ?? null,
    genres: entry.game.genres.map((genre) => genre.name),
    platforms: entry.game.platforms.map((platform) => platform.name),
  };
}

export function filterGXCalendarEntriesByMonth(entries: GXCalendarEntry[], month: string): GXCalendarGame[] {
  return entries
    .map(mapGXCalendarEntry)
    .filter((entry) => (entry.releaseDate ?? "").slice(0, 7) === month)
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.title.localeCompare(b.title));
}

export function gxCalendarToGame(gx: GXCalendarGame): Game {
  const platforms = (gx.platforms ?? [])
    .map(mapGXPlatformName)
    .filter(Boolean) as Platform[];
  const slug = gx.slug ?? slugify(gx.title);

  return {
    id: `gx-cal-${slug}`,
    slug,
    title: gx.title,
    subtitle: undefined,
    coverImage: gx.cover ?? "",
    headerImage: gx.cover ?? "",
    screenshots: [],
    platforms,
    genres: gx.genres ?? [],
    tags: [],
    developer: "",
    publisher: "",
    releaseDate: gx.releaseDate ?? "",
    description: "",
    score: 0,
    verdictLabel: "COMING SOON",
    verdictSummary: "",
    pros: [],
    cons: [],
    monetization: "Unknown",
    performanceNotes: "",
    monetizationNotes: "",
    reviewCount: 0,
    featured: false,
    trending: false,
    isProvisional: true,
    scoreSource: "gx",
  };
}

export function mergeCalendarGames(dbGames: Game[], gxGames: GXCalendarGame[]): Game[] {
  const normalizedDbGames = [...dbGames].sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? "") || a.title.localeCompare(b.title));
  const dbSlugs = new Set(normalizedDbGames.map((game) => game.slug));
  const dbTitles = new Set(normalizedDbGames.map((game) => game.title.toLowerCase()));
  const gxOnlyGames = gxGames
    .map(gxCalendarToGame)
    .filter((game) => !dbSlugs.has(game.slug) && !dbTitles.has(game.title.toLowerCase()));

  return [...normalizedDbGames, ...gxOnlyGames]
    .sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? "") || a.title.localeCompare(b.title));
}
