/**
 * GET /api/calendar — Release calendar
 *
 * Query params: month (YYYY-MM), limit
 */

export const revalidate = 300; // ISR: revalidate every 5 minutes

import { NextRequest, NextResponse } from "next/server";
import { jsonBadRequest } from "@/lib/api/response";
import { createEmptyCalendarMonthResponse, loadCalendarMonth, normalizeCalendarLimit, CALENDAR_API_CACHE_CONTROL, CALENDAR_REVALIDATE_SECONDS } from "@/lib/services/calendar";
import { parseCalendarPageState } from "@/lib/utils/gx-calendar";

if (CALENDAR_REVALIDATE_SECONDS !== revalidate) {
  throw new Error("Calendar API route revalidate must match the shared calendar loader contract.");
}

export async function GET(request: NextRequest) {
  const state = parseCalendarPageState(request.nextUrl.searchParams);
  const rawLimit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10);
  const limit = normalizeCalendarLimit(rawLimit);

  if (state.hadInvalidMonth) {
    return jsonBadRequest("Invalid month format. Expected YYYY-MM.");
  }

  try {
    const data = await loadCalendarMonth(state.month, limit);

    return NextResponse.json(
      { success: true, data },
      {
        status: 200,
        headers: {
          "Cache-Control": CALENDAR_API_CACHE_CONTROL,
        },
      }
    );
  } catch (err) {
    console.error("[API] /calendar error:", err);
    return NextResponse.json(
      { success: true, data: createEmptyCalendarMonthResponse(state.month) },
      {
        status: 200,
        headers: {
          "Cache-Control": CALENDAR_API_CACHE_CONTROL,
        },
      }
    );
  }
}
