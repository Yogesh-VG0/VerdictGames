import type { GXCalendarEntry } from "@/lib/external/gxcorner";
import type { CalendarGame, Game, GXCalendarGame, Platform } from "@/lib/types";
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
  if (value.includes("switch 2")) return "Nintendo Switch 2";
  if (value.includes("switch")) return "Nintendo Switch";
  if (value.includes("android")) return "Android";
  if (value.includes("ios")) return "iOS";
  if (value.includes("mac")) return "macOS";
  if (value.includes("linux")) return "Linux";
  return null;
}

function mapGXPlatformNames(platforms: string[]): Platform[] {
  const mapped: Platform[] = [];
  const seen = new Set<Platform>();

  for (const platform of platforms) {
    const resolved = mapGXPlatformName(platform);
    if (!resolved || seen.has(resolved)) {
      continue;
    }

    seen.add(resolved);
    mapped.push(resolved);
  }

  return mapped;
}

function getGXCalendarPlatformNames(entry: GXCalendarEntry): string[] {
  const source = entry.platforms.length > 0 ? entry.platforms : entry.game.platforms;
  return source.map((platform) => platform.name).filter(Boolean);
}

function normalizeCalendarIdentity(value: string): string {
  return value.trim().toLowerCase();
}

function getCalendarMatchKey(item: { slug?: string | null; title: string }): string {
  const slug = item.slug?.trim();
  return slug ? `slug:${slug}` : `title:${normalizeCalendarIdentity(item.title)}`;
}

function inferCalendarTagFromPlatforms(platforms: string[]): { label: string; color: string | null } | null {
  const normalized = platforms.map((platform) => platform.toLowerCase());

  if (normalized.some((platform) => platform.includes("vr"))) {
    return { label: "VR", color: "#7c3aed" };
  }

  const labels = new Set<string>();
  for (const platform of normalized) {
    if (platform.includes("switch 2")) {
      labels.add("SWITCH 2");
      continue;
    }

    if (platform.includes("switch")) {
      labels.add("SWITCH");
      continue;
    }

    if (platform.includes("windows") || platform === "pc") {
      labels.add("PC");
      continue;
    }

    if (platform.includes("playstation") || platform === "ps5") {
      labels.add("PLAYSTATION");
      continue;
    }

    if (platform.includes("xbox")) {
      labels.add("XBOX");
      continue;
    }

    if (platform.includes("android")) {
      labels.add("ANDROID");
      continue;
    }

    if (platform.includes("ios")) {
      labels.add("IOS");
      continue;
    }

    if (platform.includes("mac")) {
      labels.add("MAC");
      continue;
    }

    if (platform.includes("linux")) {
      labels.add("LINUX");
    }
  }

  const [label] = Array.from(labels);
  return labels.size === 1 && label ? { label, color: "#4d4dff" } : null;
}

function resolveGXCalendarTag(gx: GXCalendarGame): { label: string; color: string | null } | null {
  if (gx.tagLabel) {
    return { label: gx.tagLabel, color: gx.tagColor };
  }

  if (gx.hotGame) {
    return { label: "HOT", color: "#f10808" };
  }

  const originalDay = gx.originalReleaseDate?.slice(0, 10) ?? null;
  const entryDay = gx.releaseDate?.slice(0, 10) ?? null;
  if (!originalDay || !entryDay || originalDay >= entryDay) {
    return inferCalendarTagFromPlatforms(gx.platforms);
  }

  return inferCalendarTagFromPlatforms(gx.platforms) ?? { label: "PLATFORM LAUNCH", color: "#4d4dff" };
}

function buildCalendarEntryId(item: {
  title: string;
  slug?: string | null;
  releaseDate: string;
  platforms: string[];
  tagLabel?: string | null;
}): string {
  const slug = item.slug ?? slugify(item.title);
  const day = item.releaseDate.slice(0, 10) || "tba";
  const platformKey = item.platforms
    .map((platform) => platform.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    .filter(Boolean)
    .join(".") || "all";
  const tagKey = (item.tagLabel ?? "none").toLowerCase().replace(/[^a-z0-9]+/g, "-") || "none";
  return `gx-cal:${slug}:${day}:${platformKey}:${tagKey}`;
}

function toCalendarGame(game: Game): CalendarGame {
  return {
    ...game,
    calendarEntryPlatforms: game.platforms,
    calendarEntryPlatformNames: game.platforms.map((platform) => String(platform)),
    calendarHasDetailPage: Boolean(game.slug),
  };
}

function applyGXCalendarContext(baseGame: Game, gx: GXCalendarGame): CalendarGame {
  const calendarPlatforms = mapGXPlatformNames(gx.platforms);
  const resolvedTag = resolveGXCalendarTag(gx);

  return {
    ...baseGame,
    id: buildCalendarEntryId(gx),
    releaseDate: gx.releaseDate,
    platforms: calendarPlatforms.length > 0 ? calendarPlatforms : baseGame.platforms,
    calendarOriginalReleaseDate: gx.originalReleaseDate ?? baseGame.releaseDate ?? undefined,
    calendarEntryTag: resolvedTag?.label ?? null,
    calendarEntryTagColor: resolvedTag?.color ?? null,
    calendarEntryPlatforms: calendarPlatforms.length > 0 ? calendarPlatforms : baseGame.platforms,
    calendarEntryPlatformNames: gx.platforms,
    calendarUrl: gx.url,
    calendarCtaLabel: gx.ctaLabel,
    calendarIsHot: gx.hotGame,
    calendarHasDetailPage: Boolean(baseGame.slug),
  };
}

export function mapGXCalendarEntry(entry: GXCalendarEntry): GXCalendarGame {
  return {
    title: entry.game.title,
    slug: entry.game.slug,
    cover: entry.game.imageCoverVertical?.url ?? null,
    releaseDate: entry.release,
    originalReleaseDate: entry.game.releaseDate ?? null,
    hotGame: entry.hotGame ?? false,
    url: entry.url,
    ctaLabel: entry.cta?.label ?? null,
    tagLabel: entry.tag?.name ?? null,
    tagColor: entry.tag?.color ?? null,
    genres: entry.game.genres.map((genre) => genre.name),
    platforms: getGXCalendarPlatformNames(entry),
  };
}

export function filterGXCalendarEntriesByMonth(entries: GXCalendarEntry[], month: string): GXCalendarGame[] {
  return entries
    .map(mapGXCalendarEntry)
    .filter((entry) => (entry.releaseDate ?? "").slice(0, 7) === month)
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.title.localeCompare(b.title));
}

export function gxCalendarToGame(gx: GXCalendarGame): CalendarGame {
  const platforms = mapGXPlatformNames(gx.platforms ?? []);
  const slug = gx.slug ?? slugify(gx.title);
  const resolvedTag = resolveGXCalendarTag(gx);

  return {
    id: buildCalendarEntryId(gx),
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
    calendarOriginalReleaseDate: gx.originalReleaseDate ?? undefined,
    calendarEntryTag: resolvedTag?.label ?? null,
    calendarEntryTagColor: resolvedTag?.color ?? null,
    calendarEntryPlatforms: platforms,
    calendarEntryPlatformNames: gx.platforms,
    calendarUrl: gx.url,
    calendarCtaLabel: gx.ctaLabel,
    calendarIsHot: gx.hotGame,
    calendarHasDetailPage: false,
  };
}

export function mergeCalendarGames(dbGames: Game[], gxGames: GXCalendarGame[]): CalendarGame[] {
  const normalizedDbGames = [...dbGames].sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? "") || a.title.localeCompare(b.title));
  const dbByKey = new Map(normalizedDbGames.map((game) => [getCalendarMatchKey(game), game]));
  const matchedDbKeys = new Set<string>();
  const mergedGames: CalendarGame[] = [];

  for (const gxGame of gxGames) {
    const match = dbByKey.get(getCalendarMatchKey(gxGame));
    if (match) {
      matchedDbKeys.add(getCalendarMatchKey(match));
      mergedGames.push(applyGXCalendarContext(match, gxGame));
      continue;
    }

    mergedGames.push(gxCalendarToGame(gxGame));
  }

  for (const dbGame of normalizedDbGames) {
    const key = getCalendarMatchKey(dbGame);
    if (matchedDbKeys.has(key)) {
      continue;
    }

    mergedGames.push(toCalendarGame(dbGame));
  }

  return mergedGames
    .sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? "") || a.title.localeCompare(b.title));
}
