import { NextRequest } from "next/server";
import { jsonBadRequest, jsonOk, jsonUnavailable } from "@/lib/api/response";
import { getPublicSupabase } from "@/lib/supabase/public";

export async function GET(request: NextRequest) {
  const parameter = request.nextUrl.searchParams.get("page") ?? "1";
  const page = Number(parameter);
  const pageSize = 20;
  if (!/^\d+$/.test(parameter) || page < 1 || !Number.isSafeInteger(page * pageSize)) {
    return jsonBadRequest("Invalid editorial reviews page.");
  }
  try {
    const supabase = getPublicSupabase();

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
      .order("id", { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw error;
    if (!reviews || count === null) throw new Error("Incomplete editorial review result");

    return jsonOk({
      reviews,
      total: count,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("[Editorial Reviews API] Error:", error);
    return jsonUnavailable("Editorial reviews temporarily unavailable.");
  }
}
