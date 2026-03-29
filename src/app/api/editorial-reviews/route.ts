import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await getServerSupabase();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = 20;

    const { data: reviews, error, count } = await supabase
      .from("editorial_reviews")
      .select(`
        id,
        game_id,
        title,
        content,
        score,
        verdict_label,
        pros,
        cons,
        playtime_hours,
        platform_played,
        version_reviewed,
        is_featured,
        published_at,
        profiles!inner(id, username, display_name, avatar_url),
        games!inner(id, title, slug, cover_image, developer, release_date)
      `, { count: "exact" })
      .eq("is_published", true)
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      console.error("[Editorial Reviews API] Error:", error);
      return jsonOk({ reviews: [], total: 0, page, pageSize });
    }

    return jsonOk({
      reviews: reviews || [],
      total: count || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("[Editorial Reviews API] Error:", error);
    return jsonError(error instanceof Error ? error.message : "Failed to fetch editorial reviews", 500);
  }
}
