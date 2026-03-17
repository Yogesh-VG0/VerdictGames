import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { mapGameRow } from "@/lib/db/mappers";
import type { GameRow } from "@/lib/supabase/types";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const supabase = getServerSupabase();
  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? "";
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = supabase.from("games").select("*", { count: "exact" }) as any;

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  query = query.order("updated_at", { ascending: false }).range(offset, offset + limit - 1);
  const { data, count } = await query;

  return jsonOk({
    games: ((data ?? []) as GameRow[]).map(mapGameRow),
    total: count ?? 0,
    page,
    pageSize: limit,
  });
}
