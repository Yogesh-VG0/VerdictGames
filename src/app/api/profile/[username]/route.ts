/**
 * GET /api/profile/[username]
 *
 * Returns a user profile with stats, counts, and recent activity.
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

    // Run ALL queries in parallel — counts + recent activity in one batch
    const [reviewRes, listsRes, libraryRes, followerRes, followingRes, recentReviewsRes, recentLibraryRes] = await Promise.all([
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("profile_id", profile.id),
      supabase.from("lists").select("id", { count: "exact", head: true }).eq("owner_id", profile.id),
      supabase.from("user_games").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", profile.id),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", profile.id),
      supabase.from("reviews").select("id, rating, created_at, game:games!inner(slug, title)").eq("profile_id", profile.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("user_games").select("id, status, personal_rating, created_at, game:games!inner(slug, title)").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(10),
    ]);

    const reviewCount = reviewRes.count ?? 0;
    const listsCount = listsRes.count ?? 0;
    const libraryCount = libraryRes.count ?? 0;
    const followerCount = followerRes.count ?? 0;
    const followingCount = followingRes.count ?? 0;

    // Build recent activity from reviews + library events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentActivity: any[] = [];

    if (recentReviewsRes.data) {
      for (const r of recentReviewsRes.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const game = r.game as any;
        recentActivity.push({
          id: `review-${r.id}`,
          type: "review",
          gameSlug: game?.slug ?? "",
          gameTitle: game?.title ?? "",
          rating: r.rating,
          createdAt: r.created_at,
        });
      }
    }

    if (recentLibraryRes.data) {
      for (const ug of recentLibraryRes.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const game = ug.game as any;
        recentActivity.push({
          id: `library-${ug.id}`,
          type: ug.personal_rating ? "rating" : "library",
          gameSlug: game?.slug ?? "",
          gameTitle: game?.title ?? "",
          rating: ug.personal_rating ?? undefined,
          createdAt: ug.created_at,
        });
      }
    }

    // Sort merged activity by date, take most recent 15
    recentActivity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const trimmedActivity = recentActivity.slice(0, 15);

    const user = mapProfileRow(profile, {
      gamesReviewed: reviewCount,
      listsCreated: listsCount,
      libraryCount,
      followerCount,
      followingCount,
    });

    // Override the hardcoded empty array with real activity
    user.recentActivity = trimmedActivity;

    return jsonOk(user);
  } catch (err) {
    console.error(`[API] /profile/${username} error:`, err);
    return jsonNotFound("Profile");
  }
}
