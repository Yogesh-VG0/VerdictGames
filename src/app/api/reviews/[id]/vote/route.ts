/**
 * POST /api/reviews/[id]/vote — Vote on a review (helpful/unhelpful)
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError, jsonBadRequest } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getServerSupabase } from "@/lib/supabase/server";

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

    const supabase = getServerSupabase();

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

    return jsonOk({ voted: true });
  } catch (err) {
    console.error("[API] /reviews/[id]/vote error:", err);
    return jsonError("Failed to vote");
  }
}
