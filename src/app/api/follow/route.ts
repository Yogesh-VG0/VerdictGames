/**
 * POST /api/follow — Follow/unfollow a user
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError, jsonBadRequest } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getServerSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Not authenticated", 401);

  try {
    const { targetProfileId, action } = await request.json();

    if (!targetProfileId) return jsonBadRequest("targetProfileId is required");
    if (targetProfileId === user.profileId) return jsonBadRequest("Cannot follow yourself");
    if (action !== "follow" && action !== "unfollow") return jsonBadRequest("action must be 'follow' or 'unfollow'");

    const supabase = getServerSupabase();

    if (action === "follow") {
      const { error } = await supabase
        .from("follows")
        .upsert(
          { follower_id: user.profileId, following_id: targetProfileId },
          { onConflict: "follower_id,following_id" }
        );
      if (error) throw error;
      return jsonOk({ following: true });
    } else {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.profileId)
        .eq("following_id", targetProfileId);
      if (error) throw error;
      return jsonOk({ following: false });
    }
  } catch (err) {
    console.error("[API] /follow POST error:", err);
    return jsonError("Failed to update follow");
  }
}
