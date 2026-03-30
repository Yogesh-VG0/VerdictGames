import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { getPublicSupabase } from "@/lib/supabase/public";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = getPublicSupabase();

    // First get the game ID from slug
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id")
      .eq("slug", slug)
      .single();

    if (gameError || !game) {
      return jsonOk({ reviews: [] });
    }

    // Fetch published editorial reviews for this game
    const { data: reviews, error } = await supabase
      .from("editorial_reviews")
      .select(`
        id,
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
        profiles!inner(id, username, display_name, avatar_url)
      `)
      .eq("game_id", game.id)
      .eq("is_published", true)
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false });

    if (error) {
      console.error("[Editorial Reviews] Error:", error);
      return jsonOk({ reviews: [] });
    }

    return jsonOk({ reviews: reviews || [] });
  } catch (error) {
    console.error("[Editorial Reviews] Error:", error);
    return jsonError(error instanceof Error ? error.message : "Failed to fetch editorial reviews", 500);
  }
}
