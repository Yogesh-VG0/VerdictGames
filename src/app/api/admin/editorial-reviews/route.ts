import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;
    
    const supabase = await getServerSupabase();
    
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = 20;

    let query = supabase
      .from("editorial_reviews")
      .select(`
        *,
        games!inner(id, title, slug, cover_image),
        profiles!inner(id, username, display_name, avatar_url)
      `, { count: "exact" })
      .order("updated_at", { ascending: false });

    if (gameId) {
      query = query.eq("game_id", gameId);
    }

    const { data, error, count } = await query
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw error;

    return jsonOk({
      reviews: data || [],
      total: count || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("[Admin Editorial Reviews] GET error:", error);
    return jsonError(error instanceof Error ? error.message : "Failed to fetch editorial reviews", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: admin, error: authError } = await requireAdmin();
    if (authError) return authError;
    
    const supabase = await getServerSupabase();
    const body = await request.json();

    const { game_id, title, content, score, verdict_label, pros, cons, playtime_hours, platform_played, version_reviewed, is_published, is_featured } = body;

    if (!game_id || !content) {
      return jsonError("game_id and content are required", 400);
    }

    const { data, error } = await supabase
      .from("editorial_reviews")
      .insert({
        game_id,
        author_id: admin!.profileId,
        title: title || null,
        content,
        score: score ?? null,
        verdict_label: verdict_label || null,
        pros: pros || [],
        cons: cons || [],
        playtime_hours: playtime_hours ?? null,
        platform_played: platform_played || null,
        version_reviewed: version_reviewed || null,
        is_published: is_published ?? false,
        is_featured: is_featured ?? false,
        published_at: is_published ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;

    return jsonOk(data);
  } catch (error) {
    console.error("[Admin Editorial Reviews] POST error:", error);
    return jsonError(error instanceof Error ? error.message : "Failed to create editorial review", 500);
  }
}
