/**
 * GET /api/calendar — Release calendar
 *
 * Query params: month (YYYY-MM), limit
 */

import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api/response";
import { mapGameRow } from "@/lib/db/mappers";
import type { GameRow } from "@/lib/supabase/types";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const month = params.get("month"); // YYYY-MM
  const limit = parseInt(params.get("limit") ?? "50", 10);

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonOk([]);
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    let query = supabase
      .from("games")
      .select("*")
      .not("release_date", "is", null)
      .order("release_date", { ascending: true })
      .limit(limit);

    if (month) {
      const [year, mon] = month.split("-");
      const start = `${year}-${mon}-01`;
      const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
      const end = `${year}-${mon}-${lastDay}`;
      query = query.gte("release_date", start).lte("release_date", end);
    } else {
      // Default: upcoming (next 3 months)
      const now = new Date();
      const start = now.toISOString().split("T")[0];
      const future = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
      const end = future.toISOString().split("T")[0];
      query = query.gte("release_date", start).lte("release_date", end);
    }

    const { data, error } = await query as { data: GameRow[] | null; error: unknown };
    if (error) throw error;

    return jsonOk((data ?? []).map(mapGameRow));
  } catch (err) {
    console.error("[API] /calendar error:", err);
    return jsonOk([]);
  }
}
