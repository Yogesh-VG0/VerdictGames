/**
 * POST /api/reviews/[id]/vote — Vote on a review (helpful/unhelpful)
 * 
 * Body: { value: 1 | -1 }
 * - Upserts into review_votes
 * - If value matches current vote, removes the vote (toggle off)
 * - Syncs reviews.helpful with actual count from review_votes
 * - Returns updated counts and vote state
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError, jsonBadRequest } from "@/lib/api/response";
import { getReviewVoteAggregates, getReviewVoteCounts } from "@/lib/reviewVotes";
import { getAuthSupabase, getCurrentUser } from "@/lib/supabase/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reviewId } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError("Not authenticated", 401);

  try {
    const body = await request.json();
    const { value } = body; // 1 or -1

    if (value !== 1 && value !== -1) return jsonBadRequest("value must be 1 or -1");

    const supabase = await getAuthSupabase();

    // Check if user already has a vote on this review
    const { data: existingVote } = await supabase
      .from("review_votes")
      .select("id, value")
      .eq("review_id", reviewId)
      .eq("profile_id", user.profileId)
      .maybeSingle();

    let newVoteValue: number | null = value;

    if (existingVote && existingVote.value === value) {
      // Same vote → toggle off (remove)
      await supabase
        .from("review_votes")
        .delete()
        .eq("id", existingVote.id);
      newVoteValue = null;
    } else {
      // Upsert vote
      const { error } = await supabase
        .from("review_votes")
        .upsert(
          {
            review_id: reviewId,
            profile_id: user.profileId,
            value,
          },
          { onConflict: "review_id,profile_id" }
        );

      if (error) throw error;
    }

    const { data: reviewRow, error: reviewError } = await supabase
      .from("reviews")
      .select("id, helpful")
      .eq("id", reviewId)
      .maybeSingle();

    if (reviewError) throw reviewError;

    if (!reviewRow) return jsonError("Review not found", 404);

    const voteCounts = await getReviewVoteAggregates(supabase, [reviewId]);
    const { helpful, notHelpful } = getReviewVoteCounts(reviewRow, voteCounts);

    return jsonOk({
      voted: newVoteValue !== null,
      userVote: newVoteValue,
      helpful,
      notHelpful,
    });
  } catch (err) {
    console.error("[API] /reviews/[id]/vote error:", err);
    return jsonError("Failed to vote");
  }
}
