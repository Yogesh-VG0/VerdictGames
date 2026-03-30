import { unstable_cache } from "next/cache";
import { GAME_CARD_COLUMNS_WITH_DESC } from "@/lib/db/columns";
import { mapGameRow } from "@/lib/db/mappers";
import { gxFetchCalendarMonthSnapshot } from "@/lib/external/gx-cache";
import { getGXCalendar } from "@/lib/external/gxcorner";
import { getPublicSupabase, hasPublicSupabaseEnv } from "@/lib/supabase/public";
import type { CalendarMonthResponse } from "@/lib/types";
import type { GameRow } from "@/lib/supabase/types";
import { mergeCalendarGames } from "@/lib/utils/gx-calendar";
import { hasUsableCardImage } from "@/lib/utils/mediaReadiness";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";

export const CALENDAR_REVALIDATE_SECONDS = 300;
export const CALENDAR_API_CACHE_CONTROL = `s-maxage=${CALENDAR_REVALIDATE_SECONDS}, stale-while-revalidate=3600`;
export const CALENDAR_DEFAULT_LIMIT = 50;
export const CALENDAR_MAX_LIMIT = 200;

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

async function fetchCalendarMonth(month: string, limit: number): Promise<CalendarMonthResponse> {
  if (!hasPublicSupabaseEnv()) {
    return createEmptyCalendarMonthResponse(month);
  }

  const supabase = getPublicSupabase();
  const [year, mon] = month.split("-");
  const start = `${year}-${mon}-01`;
  const lastDay = new Date(Number.parseInt(year, 10), Number.parseInt(mon, 10), 0).getDate();
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
    .limit(limit * 2);
  const dbQuery = query.then((result) => result as { data: GameRow[] | null; error: unknown });

  const [{ data, error }, gxCalendar] = await Promise.all([
    dbQuery,
    gxFetchCalendarMonthSnapshot(month, getGXCalendar),
  ]);

  if (error) {
    throw error;
  }

  const dbGames = (data ?? [])
    .filter((row) => isPublicSafeGame(row) && hasUsableCardImage(row))
    .map(mapGameRow);

  return {
    month,
    items: mergeCalendarGames(dbGames, gxCalendar.items).slice(0, limit),
    gxSource: gxCalendar.source,
    gxCount: gxCalendar.items.length,
    dbCount: dbGames.length,
    gxFetchedAt: gxCalendar.fetchedAt,
  };
}

export async function loadCalendarMonth(month: string, limit = CALENDAR_DEFAULT_LIMIT): Promise<CalendarMonthResponse> {
  const normalizedLimit = normalizeCalendarLimit(limit);
  return unstable_cache(
    () => fetchCalendarMonth(month, normalizedLimit),
    ["calendar-month", month, String(normalizedLimit)],
    { revalidate: CALENDAR_REVALIDATE_SECONDS }
  )();
}
