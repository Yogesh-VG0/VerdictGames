import { jsonOk } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const supabase = getServerSupabase();

  const [games, reviews, profiles] = await Promise.all([
    supabase.from("games").select("id", { count: "exact", head: true }),
    supabase.from("reviews").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  return jsonOk({
    totalGames: games.count ?? 0,
    totalReviews: reviews.count ?? 0,
    totalUsers: profiles.count ?? 0,
  });
}
