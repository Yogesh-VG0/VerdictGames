import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { getPublicSupabase } from "@/lib/supabase/public";
import { boundedHomepageRead } from "@/lib/services/homepage-budget";

export const maxDuration = 10;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { data: reviews, error } = await boundedHomepageRead(3500, async () => getPublicSupabase()
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
        profiles!inner(id, username, display_name, avatar_url),
        games!inner()
      `)
      .eq("games.slug", slug)
      .eq("is_published", true)
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false })
      .abortSignal(AbortSignal.timeout(3200)));
    if (error) throw error;

    return jsonOk({ reviews: reviews || [] });
  } catch (error) {
    console.error("[Editorial Reviews] Error:", error);
    return jsonError("Editorial reviews temporarily unavailable", 503);
  }
}
