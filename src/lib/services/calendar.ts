import { unstable_cache } from "next/cache";
import { GAME_CARD_COLUMNS_WITH_DESC } from "@/lib/db/columns";
import { mapGameRow } from "@/lib/db/mappers";
import { gxFetchCalendarMonthSnapshot } from "@/lib/external/gx-cache";
import { getGXCalendar } from "@/lib/external/gxcorner";
import { getPublicSupabase, hasPublicSupabaseEnv } from "@/lib/supabase/public";
import type { CalendarMonthResponse } from "@/lib/types";
import type { GameRow } from "@/lib/supabase/types";
import { getCalendarMonthKey, gxCalendarToGame, mergeCalendarGames } from "@/lib/utils/gx-calendar";
import { hasUsableCardImage } from "@/lib/utils/mediaReadiness";
import { loadExplore } from '@/lib/services/explore';
import { boundedHomepageRead } from '@/lib/services/homepage-budget';
import { normalizeTitle } from '@/lib/utils/slugify';
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { IncompleteCatalogueRead } from "@/lib/db/cached-catalogue";
import { releaseTimingMonth, resolveReleaseTiming } from '@/lib/utils/release-timing';

export const CALENDAR_REVALIDATE_SECONDS = 300;
export const CALENDAR_API_CACHE_CONTROL = `s-maxage=${CALENDAR_REVALIDATE_SECONDS}, stale-while-revalidate=3600`;
export const CALENDAR_DEFAULT_LIMIT = 50;
export const CALENDAR_MAX_LIMIT = 200;
const CALENDAR_MONTH_CACHE_NAMESPACE = "calendar-month-v6-precision";

export function normalizeCalendarLimit(limit?: number): number {
  return Number.isFinite(limit) && Number(limit) > 0
    ? Math.min(Number(limit), CALENDAR_MAX_LIMIT)
    : CALENDAR_DEFAULT_LIMIT;
}

export function createEmptyCalendarMonthResponse(month: string): CalendarMonthResponse {
  return {
    month,
    items: [],
    gxSource: "empty",
    gxCount: 0,
    dbCount: 0,
  };
}

function dedupeRowsById(rows: GameRow[]): GameRow[] {
  const byId = new Map<string, GameRow>();
  for (const row of rows) {
    byId.set(row.id, row);
  }
  return Array.from(byId.values());
}

async function fetchCalendarContextMatches(args: {
  supabase: ReturnType<typeof getPublicSupabase>;
  slugs: string[];
  titles: string[];
}): Promise<GameRow[]> {
  const queries: Array<Promise<{ data: GameRow[] | null; error: unknown }>> = [];

  if (args.slugs.length > 0) {
    queries.push(
      args.supabase
        .from("games")
        .select(GAME_CARD_COLUMNS_WITH_DESC)
        .in("slug", args.slugs)
        .limit(Math.min(200, Math.max(args.slugs.length * 2, 25)))
        .abortSignal(AbortSignal.timeout(1800)) as unknown as Promise<{ data: GameRow[] | null; error: unknown }>
    );
  }

  if (args.titles.length > 0) {
    queries.push(
      args.supabase
        .from("games")
        .select(GAME_CARD_COLUMNS_WITH_DESC)
        .in("title", args.titles)
        .limit(Math.min(200, Math.max(args.titles.length * 2, 25)))
        .abortSignal(AbortSignal.timeout(1800)) as unknown as Promise<{ data: GameRow[] | null; error: unknown }>
    );
  }

  if (queries.length === 0) {
    return [];
  }

  const results = await Promise.all(queries);
  const rows = results.flatMap((result) => result.data ?? []);
  return dedupeRowsById(rows);
}

async function fetchCalendarMonth(month: string, limit: number): Promise<CalendarMonthResponse> {
  if (!hasPublicSupabaseEnv()) {
    return createEmptyCalendarMonthResponse(month);
  }

  const supabase = getPublicSupabase();
  const [year, mon] = month.split("-");
  const start = `${year}-${mon}-01`;
  const lastDay = new Date(Date.UTC(Number.parseInt(year, 10), Number.parseInt(mon, 10), 0)).getUTCDate();
  const end = `${year}-${mon}-${String(lastDay).padStart(2, "0")}`;

  const query = supabase
    .from("games")
    .select(GAME_CARD_COLUMNS_WITH_DESC)
    .not("release_date", "is", null)
    .not("cover_image", "is", null)
    .neq("cover_image", "")
    .gte("release_date", start)
    .lte("release_date", end)
    .order("release_date", { ascending: true })
    .limit(limit * 2)
    .abortSignal(AbortSignal.timeout(4000));
  const dbQuery = Promise.resolve(query).then((result) => result as { data: GameRow[] | null; error: unknown });

  const [dbResult, gxResult, upcoming] = await Promise.all([
    dbQuery.catch(() => ({ data: null, error: new Error('Catalogue calendar unavailable') })),
    boundedHomepageRead(6500, () => gxFetchCalendarMonthSnapshot(month, getGXCalendar)).catch(() => null),
    month >= getCalendarMonthKey() ? boundedHomepageRead(4200, () => loadExplore('best-of-year', 1, 100, undefined, undefined, 'oldest', '', undefined, { snapshotOnly: true, calendar: true })).catch(() => null) : null,
  ]);
  const { data, error } = dbResult;
  const gxCalendar = gxResult ?? { items: [], source: 'empty' as const, fetchedAt: undefined };

  const monthRows = (data ?? []).filter(row => isPublicSafeGame(row) && hasUsableCardImage(row)
    && !["cancelled", "canceled", "delisted", "tba"].includes(row.release_status ?? ""));

  const gxSlugs = Array.from(new Set(gxCalendar.items.map((item) => item.slug).filter((slug): slug is string => Boolean(slug))));
  const gxTitles = Array.from(new Set(gxCalendar.items.map((item) => item.title).filter(Boolean)));

  let contextRows: GameRow[] = [];
  try {
    contextRows = (await fetchCalendarContextMatches({
      supabase,
      slugs: gxSlugs,
      titles: gxTitles,
    })).filter((row) => isPublicSafeGame(row) && hasUsableCardImage(row));
  } catch {
    contextRows = [];
  }

  const dbMonthGames = monthRows.map(mapGameRow);
  const dbContextGames = contextRows.map(mapGameRow);
  const dbGames = Array.from(new Map([...dbMonthGames, ...dbContextGames].map((game) => [game.id, game])).values());

  const items = mergeCalendarGames(dbGames, gxCalendar.items).filter(game => game.releaseDate?.slice(0, 7) === month);
  const today = new Date().toISOString().slice(0, 10);
  for (const game of items) {
    if (!game.releaseTiming || game.releaseDate !== game.calendarOriginalReleaseDate) {
      game.releaseTiming = resolveReleaseTiming(game.releaseDate, { upcoming: game.releaseDate > today });
    }
  }
  const upcomingAge = upcoming?.fetchedAt ? Date.now() - Date.parse(upcoming.fetchedAt) : Infinity;
  const usableUpcoming = upcoming?.source === 'rawg' && upcomingAge >= 0 && upcomingAge <= 12 * 60 * 60 * 1000;
  if (usableUpcoming && upcoming) {
    for (const game of upcoming.items) {
      const timing = game.releaseTiming ?? resolveReleaseTiming(game.released, { upcoming: true, tba: game.tba });
      const titleKey = normalizeTitle(game.name);
      const matches = items.filter(entry => entry.slug === game.slug || normalizeTitle(entry.title) === titleKey);
      if (matches.length) {
        for (const match of matches) {
          if (match.releaseDate.slice(0, 10) !== game.released && match.releaseTiming?.precision === 'day') continue;
          match.releaseTiming = timing;
          if (game.earlyAccess) match.calendarEntryTag = 'Full release pending';
        }
        continue;
      }
      if (releaseTimingMonth(timing) !== month) continue;
      const entry = gxCalendarToGame({ title: game.name, slug: game.slug, cover: game.image,
        releaseDate: game.released ?? (timing.precision === 'day' ? timing.value : ''), originalReleaseDate: null, hotGame: false,
        url: null, ctaLabel: null, tagLabel: game.earlyAccess ? 'Full release pending' : null, tagColor: null,
        genres: game.genres, platforms: game.platforms });
      items.push({ ...entry, rawgId: game.rawgId, scoreSource: 'rawg', calendarHasDetailPage: true,
        releaseTiming: timing });
    }
  }
  const unavailable = [
    ...(error ? ['catalogue'] : []),
    ...(gxCalendar.source === 'empty' ? ['GX calendar'] : []),
    ...(month >= getCalendarMonthKey() && (!usableUpcoming || upcoming?.degraded) ? ['upcoming snapshot'] : []),
  ];
  const dataForMonth: CalendarMonthResponse = {
    month,
    items: items.filter(game => game.releaseTiming && releaseTimingMonth(game.releaseTiming) === month)
      .sort((a, b) => (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999') || a.title.localeCompare(b.title)).slice(0, limit),
    gxSource: gxCalendar.source,
    gxCount: gxCalendar.items.length,
    dbCount: dbMonthGames.length,
    gxFetchedAt: gxCalendar.fetchedAt,
  };
  if (unavailable.length) {
    throw new IncompleteCatalogueRead({ ...dataForMonth, unavailable: true }, unavailable);
  }
  return dataForMonth;
}

export async function loadCalendarMonth(month: string, limit = CALENDAR_DEFAULT_LIMIT): Promise<CalendarMonthResponse> {
  const normalizedLimit = normalizeCalendarLimit(limit);
  try {
    return await unstable_cache(
      () => fetchCalendarMonth(month, normalizedLimit),
      [CALENDAR_MONTH_CACHE_NAMESPACE, month, String(normalizedLimit)],
      { revalidate: CALENDAR_REVALIDATE_SECONDS }
    )();
  } catch (error) {
    if (error instanceof IncompleteCatalogueRead) return error.data as CalendarMonthResponse;
    throw error;
  }
}
