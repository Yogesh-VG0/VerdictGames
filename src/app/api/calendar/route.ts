/**
 * GET /api/calendar — Release calendar
 *
 * Query params: month (YYYY-MM), limit
 */

export const revalidate = 300; // ISR: revalidate every 5 minutes

import { NextRequest } from "next/server";
import { jsonBadRequest, jsonOk } from "@/lib/api/response";
import { mapGameRow } from "@/lib/db/mappers";
import { GAME_CARD_COLUMNS_WITH_DESC } from "@/lib/db/columns";
import { getGXCalendar } from "@/lib/external/gxcorner";
import { gxFetchCalendarMonthSnapshot } from "@/lib/external/gx-cache";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { hasUsableCardImage } from "@/lib/utils/mediaReadiness";
import { mergeCalendarGames, resolveCalendarMonthKey } from "@/lib/utils/gx-calendar";
import type { CalendarMonthResponse } from "@/lib/types";
import type { GameRow } from "@/lib/supabase/types";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const month = resolveCalendarMonthKey(params.get("month"));
  const rawLimit = parseInt(params.get("limit") ?? "50", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;

  if (!month) {
    return jsonBadRequest("Invalid month format. Expected YYYY-MM.");
  }

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonOk<CalendarMonthResponse>({ month, items: [], gxSource: "empty", gxCount: 0, dbCount: 0 });
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    const [year, mon] = month.split("-");
    const start = `${year}-${mon}-01`;
    const lastDay = new Date(parseInt(year, 10), parseInt(mon, 10), 0).getDate();
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
      .limit(limit * 2); // Overfetch for filtering
    const dbQuery = query.then((result) => result as { data: GameRow[] | null; error: unknown });

    const [{ data, error }, gxCalendar] = await Promise.all([
      dbQuery,
      gxFetchCalendarMonthSnapshot(month, getGXCalendar),
    ]);
    if (error) throw error;

    // Apply public safety + media readiness filters
    const dbGames = (data ?? [])
      .filter((r) => isPublicSafeGame(r) && hasUsableCardImage(r))
      .map(mapGameRow);

    const merged = mergeCalendarGames(dbGames, gxCalendar.items).slice(0, limit);

    return jsonOk<CalendarMonthResponse>({
      month,
      items: merged,
      gxSource: gxCalendar.source,
      gxCount: gxCalendar.items.length,
      dbCount: dbGames.length,
      gxFetchedAt: gxCalendar.fetchedAt,
    }, 200, { cache: true });
  } catch (err) {
    console.error("[API] /calendar error:", err);
    return jsonOk<CalendarMonthResponse>({ month, items: [], gxSource: "empty", gxCount: 0, dbCount: 0 });
  }
}
