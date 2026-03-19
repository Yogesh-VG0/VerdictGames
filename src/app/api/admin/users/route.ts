import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

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
  let query = supabase.from("profiles").select("*", { count: "exact" }) as any;

  if (q) {
    query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
  }

  query = query.order("joined_at", { ascending: false }).range(offset, offset + limit - 1);
  const { data: profiles, count } = await query;

  // Get aggregated counts for each profile
  const users = await Promise.all(
    ((profiles ?? []) as Array<{
      id: string; username: string; display_name: string; avatar_url: string;
      bio: string; role: string; joined_at: string; favorite_genres: string[];
    }>).map(async (p) => {
      const [reviewRes, listRes, libraryRes] = await Promise.all([
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("profile_id", p.id),
        supabase.from("lists").select("id", { count: "exact", head: true }).eq("owner_id", p.id),
        supabase.from("user_games").select("id", { count: "exact", head: true }).eq("user_id", p.id),
      ]);

      return {
        id: p.id,
        username: p.username,
        displayName: p.display_name,
        avatar: p.avatar_url,
        bio: p.bio,
        role: p.role,
        joinedAt: p.joined_at,
        favoriteGenres: p.favorite_genres,
        reviewCount: reviewRes.count ?? 0,
        listCount: listRes.count ?? 0,
        libraryCount: libraryRes.count ?? 0,
      };
    })
  );

  return jsonOk({
    users,
    total: count ?? 0,
    page,
    pageSize: limit,
  });
}
