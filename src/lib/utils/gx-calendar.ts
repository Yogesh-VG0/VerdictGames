import type { GXCalendarEntry } from "@/lib/external/gxcorner";
import type { CalendarGame, Game, GXCalendarGame, Platform } from "@/lib/types";
import { getDiscoveryCanonicalTitle } from "@/lib/utils/discovery";
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
const CALENDAR_CONFUSABLE_ASCII_MAP: Record<string, string> = {
  А: "A",
  а: "a",
  В: "B",
  Е: "E",
  е: "e",
  К: "K",
  М: "M",
  Н: "H",
  О: "O",
  о: "o",
  Р: "P",
  р: "p",
  С: "C",
  с: "c",
  Т: "T",
  У: "Y",
  у: "y",
  Х: "X",
  х: "x",
  І: "I",
  і: "i",
  Ј: "J",
  ј: "j",
  Ѕ: "S",
  ѕ: "s",
};

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

function normalizeCalendarComparableText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split("")
    .map((char) => CALENDAR_CONFUSABLE_ASCII_MAP[char] ?? char)
    .join("");
}

function normalizeCalendarIdentity(value: string): string {
  return getDiscoveryCanonicalTitle(normalizeCalendarComparableText(value));
}

function getCalendarShortTitleAlias(title: string): string | null {
  const rawTitle = title.trim();
  const separatorIndex = rawTitle.search(/\s*:\s*|\s+[–-]\s+/);
  if (separatorIndex < 0) {
    return null;
  }

  const rawShortTitle = rawTitle.slice(0, separatorIndex).trim();
  const shortTitleWordCount = rawShortTitle.split(/\s+/).filter(Boolean).length;
  if (!rawShortTitle || shortTitleWordCount !== 1) {
    return null;
  }

  const shortTitle = normalizeCalendarComparableText(rawShortTitle).trim();
  const canonical = normalizeCalendarIdentity(shortTitle);
  return canonical.length >= 3 && canonical.length <= 6 ? canonical : null;
}

function getCalendarIdentityKey(item: { title: string }): string {
  const shortAlias = getCalendarShortTitleAlias(item.title);
  return `title:${shortAlias ?? normalizeCalendarIdentity(item.title)}`;
}

function getCalendarMatchKey(item: { slug?: string | null; title: string }): string {
  return getCalendarIdentityKey(item);
}

function getGXCalendarDedupKey(item: Pick<GXCalendarGame, "slug" | "title" | "releaseDate">): string {
  const identity = getCalendarIdentityKey(item);
  const day = item.releaseDate.slice(0, 10) || "tba";
  return `${identity}:${day}`;
}

function getGXCalendarSpecificityScore(item: GXCalendarGame): number {
  const originalDay = item.originalReleaseDate?.slice(0, 10) ?? null;
  const entryDay = item.releaseDate?.slice(0, 10) ?? null;
  let score = 0;

  if (item.tagLabel) score += 8;
  if (item.tagColor) score += 1;
  if (item.hotGame) score += 2;
  if (item.url) score += 1;
  if (item.cover) score += 1;
  if (item.ctaLabel) score += 1;
  if (originalDay && entryDay && originalDay < entryDay) score += 6;
  if (item.platforms.length > 0) score += Math.max(0, 6 - Math.min(item.platforms.length, 5));
  score += Math.min(2, normalizeCalendarIdentity(item.title).length / 10);

  return score;
}

function mergeUniqueStrings(primary: string[], secondary: string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const value of [...primary, ...secondary]) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(normalized);
  }

  return merged;
}

function mergeGXCalendarDuplicatePair(preferred: GXCalendarGame, fallback: GXCalendarGame): GXCalendarGame {
  const titleSource = normalizeCalendarIdentity(preferred.title).length >= normalizeCalendarIdentity(fallback.title).length
    ? preferred
    : fallback;

  return {
    ...preferred,
    title: titleSource.title,
    slug: titleSource.slug ?? preferred.slug ?? fallback.slug,
    cover: preferred.cover ?? fallback.cover,
    originalReleaseDate: preferred.originalReleaseDate ?? fallback.originalReleaseDate,
    hotGame: preferred.hotGame || fallback.hotGame,
    url: preferred.url ?? fallback.url,
    ctaLabel: preferred.ctaLabel ?? fallback.ctaLabel,
    tagLabel: preferred.tagLabel ?? fallback.tagLabel,
    tagColor: preferred.tagColor ?? fallback.tagColor,
    genres: mergeUniqueStrings(preferred.genres, fallback.genres),
    platforms: mergeUniqueStrings(preferred.platforms, fallback.platforms),
  };
}

export function dedupeGXCalendarGames(items: GXCalendarGame[]): GXCalendarGame[] {
  const byKey = new Map<string, GXCalendarGame>();

  for (const item of items) {
    const key = getGXCalendarDedupKey(item);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    const preferred = getGXCalendarSpecificityScore(item) > getGXCalendarSpecificityScore(existing)
      ? item
      : existing;
    const fallback = preferred === item ? existing : item;
    byKey.set(key, mergeGXCalendarDuplicatePair(preferred, fallback));
  }

  return Array.from(byKey.values());
}

function hasGXCalendarPromoTitleSignal(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return /\b(demo|playtest|trial)\b/i.test(value);
}

function hasGXCalendarPromoMetaSignal(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return /\b(demo|playtest|trial|free trial|alpha|beta|closed beta|open beta|technical test|stress test|server slam)\b/i.test(value);
}

export function shouldHideGXCalendarEntry(item: GXCalendarGame): boolean {
  return hasGXCalendarPromoTitleSignal(item.title)
    || hasGXCalendarPromoTitleSignal(item.slug)
    || hasGXCalendarPromoMetaSignal(item.tagLabel)
    || hasGXCalendarPromoMetaSignal(item.ctaLabel);
}

function shouldHideCalendarGame(item: Pick<CalendarGame, "title" | "slug" | "calendarEntryTag" | "calendarCtaLabel">): boolean {
  return hasGXCalendarPromoTitleSignal(item.title)
    || hasGXCalendarPromoTitleSignal(item.slug)
    || hasGXCalendarPromoMetaSignal(item.calendarEntryTag)
    || hasGXCalendarPromoMetaSignal(item.calendarCtaLabel);
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

function getCalendarDbSpecificityScore(game: Game): number {
  let score = 0;

  score += Math.min(6, normalizeCalendarComparableText(game.title).trim().length / 12);
  score += Math.min(4, game.platforms.length);
  score += Math.min(4, game.genres.length);
  score += Math.min(6, Math.log10((game.reviewCount ?? 0) + 1) * 2);

  if (game.description && game.description.trim().length >= 40) score += 5;
  if (game.developer?.trim()) score += 2;
  if (game.publisher?.trim()) score += 2;
  if (game.coverImage) score += 1;
  if ((game.confidence ?? 0) > 0) score += (game.confidence ?? 0) * 4;

  return score;
}

function buildCalendarDbMatchMap(games: Game[]): Map<string, Game> {
  const byKey = new Map<string, Game>();

  for (const game of games) {
    const key = getCalendarMatchKey(game);
    const existing = byKey.get(key);
    if (!existing || getCalendarDbSpecificityScore(game) > getCalendarDbSpecificityScore(existing)) {
      byKey.set(key, game);
    }
  }

  return byKey;
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
  return dedupeGXCalendarGames(
    entries
      .map(mapGXCalendarEntry)
      .filter((entry) => (entry.releaseDate ?? "").slice(0, 7) === month)
      .filter((entry) => !shouldHideGXCalendarEntry(entry))
  ).sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.title.localeCompare(b.title));
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
    calendarHasDetailPage: Boolean(gx.slug),
  };
}

export function mergeCalendarGames(dbGames: Game[], gxGames: GXCalendarGame[]): CalendarGame[] {
  const normalizedDbGames = [...dbGames].sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? "") || a.title.localeCompare(b.title));
  const normalizedGXGames = dedupeGXCalendarGames(gxGames)
    .filter((game) => !shouldHideGXCalendarEntry(game))
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.title.localeCompare(b.title));
  const dbByKey = buildCalendarDbMatchMap(normalizedDbGames);
  const matchedDbKeys = new Set<string>();
  const mergedGames: CalendarGame[] = [];

  for (const gxGame of normalizedGXGames) {
    const match = dbByKey.get(getCalendarMatchKey(gxGame));
    if (match) {
      matchedDbKeys.add(getCalendarMatchKey(match));
      mergedGames.push(applyGXCalendarContext(match, gxGame));
      continue;
    }

    mergedGames.push(gxCalendarToGame(gxGame));
  }

  for (const [key, dbGame] of dbByKey.entries()) {
    if (matchedDbKeys.has(key)) {
      continue;
    }

    mergedGames.push(toCalendarGame(dbGame));
  }

  return mergedGames
    .filter((game) => !shouldHideCalendarGame(game))
    .sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? "") || a.title.localeCompare(b.title));
}
