/**
 * GET /api/profile/[username]
 *
 * Returns a user profile with stats.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonNotFound } from "@/lib/api/response";
import { mapProfileRow } from "@/lib/db/mappers";
import type { ProfileRow } from "@/lib/supabase/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonNotFound("Profile");
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .maybeSingle() as { data: ProfileRow | null; error: unknown };

    if (error) throw error;

    if (!profile) {
      return jsonNotFound("Profile");
    }

    // Get review count
    const { count: reviewCount } = await supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id) as { count: number | null };

    // Get lists count — lists created by username
    const { count: listsCount } = await supabase
      .from("lists")
      .select("id", { count: "exact", head: true })
      .eq("curated_by", username);

    const user = mapProfileRow(profile, {
      gamesReviewed: reviewCount ?? 0,
      listsCreated: listsCount ?? 0,
    });

    return jsonOk(user);
  } catch (err) {
    console.error(`[API] /profile/${username} error:`, err);
    return jsonNotFound("Profile");
  }
}
