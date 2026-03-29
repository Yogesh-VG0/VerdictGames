import { NextRequest } from "next/server";
import { jsonBadRequest, jsonOk } from "@/lib/api/response";
import { getGXCalendar } from "@/lib/external/gxcorner";
import { gxFetchCalendarMonthSnapshot } from "@/lib/external/gx-cache";
import { resolveCalendarMonthKey } from "@/lib/utils/gx-calendar";

export const revalidate = 3600;

export async function GET(request: NextRequest) {
  const month = resolveCalendarMonthKey(request.nextUrl.searchParams.get("month"));
  if (!month) {
    return jsonBadRequest("Invalid month format. Expected YYYY-MM.");
  }

  const response = await gxFetchCalendarMonthSnapshot(month, getGXCalendar);
  return jsonOk(response, 200, { cache: true });
}
