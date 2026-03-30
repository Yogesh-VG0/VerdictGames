import type { GXCalendarEntry } from "@/lib/external/gxcorner";
import type { Game, GXCalendarGame, Platform } from "@/lib/types";
import { slugify } from "@/lib/utils/slugify";

type CalendarParamRecord = Record<string, string | string[] | undefined>;
type CalendarParamSource = URLSearchParams | CalendarParamRecord | { get(name: string): string | null } | undefined;

export interface CalendarPageState {
  month: string;
}

export interface ParsedCalendarPageState extends CalendarPageState {
  hadInvalidMonth: boolean;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isCalendarParamRecord(source: CalendarParamSource): source is CalendarParamRecord {
  return typeof source === "object"
    && source !== null
    && !(source instanceof URLSearchParams)
    && !(("get" in source) && typeof source.get === "function");
}

function readCalendarParam(source: CalendarParamSource, key: string): string | undefined {
  if (!source) {
    return undefined;
  }

  if (source instanceof URLSearchParams) {
    return source.get(key) ?? undefined;
  }

  if (typeof source === "object" && "get" in source && typeof source.get === "function") {
    return source.get(key) ?? undefined;
  }

  if (!isCalendarParamRecord(source)) {
    return undefined;
  }

  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}

function calendarMonthKeyToDate(month: string): Date {
  const [year, mon] = month.split("-").map((value) => Number.parseInt(value, 10));
  return new Date(year, mon - 1, 1);
}

export function getCalendarMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function isValidCalendarMonthKey(month: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return false;
  }

  const parsedMonth = Number.parseInt(month.slice(5, 7), 10);
  return parsedMonth >= 1 && parsedMonth <= 12;
}

export function parseCalendarPageState(source?: CalendarParamSource): ParsedCalendarPageState {
  const rawMonth = readCalendarParam(source, "month");

  if (!rawMonth) {
    return {
      month: getCalendarMonthKey(),
      hadInvalidMonth: false,
    };
  }

  if (!isValidCalendarMonthKey(rawMonth)) {
    return {
      month: getCalendarMonthKey(),
      hadInvalidMonth: true,
    };
  }

  return {
    month: rawMonth,
    hadInvalidMonth: false,
  };
}

export function resolveCalendarMonthKey(month?: string | null): string | null {
  if (!month) return getCalendarMonthKey();
  return isValidCalendarMonthKey(month) ? month : null;
}

export function isCurrentCalendarMonth(month: string, date = new Date()): boolean {
  return month === getCalendarMonthKey(date);
}

export function isPastCalendarMonth(month: string, date = new Date()): boolean {
  return month < getCalendarMonthKey(date);
}

export function getCalendarMonthLabel(month: string): string {
  const date = calendarMonthKeyToDate(month);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function buildCalendarMonthOptions(selectedMonth: string, date = new Date()): { key: string; label: string; shortLabel: string }[] {
  const defaultStartDate = new Date(date.getFullYear(), date.getMonth() - 3, 1);
  const defaultEndDate = new Date(defaultStartDate.getFullYear(), defaultStartDate.getMonth() + 11, 1);
  const defaultStartKey = getCalendarMonthKey(defaultStartDate);
  const defaultEndKey = getCalendarMonthKey(defaultEndDate);
  const selectedDate = calendarMonthKeyToDate(selectedMonth);
  const startDate = selectedMonth >= defaultStartKey && selectedMonth <= defaultEndKey
    ? defaultStartDate
    : new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 3, 1);

  return Array.from({ length: 12 }, (_, index) => {
    const optionDate = new Date(startDate.getFullYear(), startDate.getMonth() + index, 1);
    const key = getCalendarMonthKey(optionDate);
    return {
      key,
      label: getCalendarMonthLabel(key),
      shortLabel: `${MONTHS[optionDate.getMonth()].slice(0, 3)} '${String(optionDate.getFullYear()).slice(2)}`,
    };
  });
}

export function buildCalendarPagePath(state: CalendarPageState | string): string {
  const month = typeof state === "string" ? state : state.month;
  const params = new URLSearchParams();

  if (!isCurrentCalendarMonth(month)) {
    params.set("month", month);
  }

  const queryString = params.toString();
  return queryString ? `/calendar?${queryString}` : "/calendar";
}

export function buildCalendarApiPath(month?: string): string {
  const state = parseCalendarPageState(month ? { month } : undefined);
  const params = new URLSearchParams();

  if (!isCurrentCalendarMonth(state.month)) {
    params.set("month", state.month);
  }

  const queryString = params.toString();
  return queryString ? `/api/calendar?${queryString}` : "/api/calendar";
}

export function getCalendarSeoCopy(month: string): { title: string; description: string } {
  const monthLabel = getCalendarMonthLabel(month);
  return {
    title: `Release Calendar — ${monthLabel}`,
    description: `Upcoming and recent game launches for ${monthLabel} across PC, PlayStation 5, Xbox, Nintendo Switch, and more on verdict.games.`,
  };
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
