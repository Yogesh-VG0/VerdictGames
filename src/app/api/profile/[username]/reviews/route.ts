import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api/response";
import { mapReviewRow } from "@/lib/db/mappers";
import { attachReviewVoteFields, getReviewVoteAggregates, getUserReviewVotes } from "@/lib/reviewVotes";
import { getAuthSupabase, getCurrentUser } from "@/lib/supabase/auth";
import { getPublicSupabase, hasPublicSupabaseEnv } from "@/lib/supabase/public";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  try {
    if (!hasPublicSupabaseEnv()) {
      return jsonOk([]);
    }

    const supabase = getPublicSupabase();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle() as { data: { id: string } | null };

    if (!profile) {
      return jsonOk([]);
    }

    const { data, error } = await supabase
      .from("reviews")
      .select(
        `
        *,
        game:games!inner(slug, title, cover_image),
        profile:profiles!inner(username, display_name, avatar_url)
        `
      )
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const reviewIds = (data ?? []).map((row: Record<string, unknown>) => row.id as string);
    const currentUser = await getCurrentUser();
    const authSupabase = await getAuthSupabase();
    const voteCounts = await getReviewVoteAggregates(authSupabase, reviewIds);
    const userVotes = await getUserReviewVotes(authSupabase, reviewIds, currentUser?.profileId ?? null);

    const reviews = (data ?? []).map((row: Record<string, unknown>) => {
      const enrichedRow = attachReviewVoteFields(
        row as unknown as Parameters<typeof attachReviewVoteFields>[0],
        userVotes,
        voteCounts
      );

      return mapReviewRow(enrichedRow as Parameters<typeof mapReviewRow>[0]);
    });

    return jsonOk(reviews);
  } catch (err) {
    console.error(`[API] /profile/${username}/reviews error:`, err);
    return jsonOk([]);
  }
}
