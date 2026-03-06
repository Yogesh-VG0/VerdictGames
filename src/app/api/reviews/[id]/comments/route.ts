/**
 * GET /api/reviews/[id]/comments — Get comments on a review
 * POST /api/reviews/[id]/comments — Add a comment to a review
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError, jsonBadRequest } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { mapCommentRow } from "@/lib/db/mappers";
import type { ReviewComment } from "@/lib/types";
import type { ReviewCommentRow } from "@/lib/supabase/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reviewId } = await params;

  try {
    const supabase = getServerSupabase();

    const { data, error } = await supabase
      .from("review_comments")
      .select("*, profile:profiles!inner(username, avatar_url)")
      .eq("review_id", reviewId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const flat = (data ?? []).map((row: Record<string, unknown>) =>
      mapCommentRow(row as ReviewCommentRow & { profile: { username: string; avatar_url: string } })
    );

    // Build nested tree
    const commentMap = new Map<string, ReviewComment>();
    const roots: ReviewComment[] = [];

    for (const c of flat) {
      commentMap.set(c.id, { ...c, replies: [] });
    }

    for (const c of flat) {
      const comment = commentMap.get(c.id)!;
      if (c.parentId && commentMap.has(c.parentId)) {
        commentMap.get(c.parentId)!.replies!.push(comment);
      } else {
        roots.push(comment);
      }
    }

    return jsonOk(roots);
  } catch (err) {
    console.error("[API] /reviews/[id]/comments GET error:", err);
    return jsonOk([]);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reviewId } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError("Not authenticated", 401);

  try {
    const { body: commentBody, parentId } = await request.json();

    if (!commentBody || commentBody.trim().length === 0) {
      return jsonBadRequest("Comment body is required");
    }
    if (commentBody.length > 2000) {
      return jsonBadRequest("Comment must be 2000 characters or less");
    }

    const supabase = getServerSupabase();

    const { data, error } = await supabase
      .from("review_comments")
      .insert({
        review_id: reviewId,
        profile_id: user.profileId,
        body: commentBody.trim(),
        parent_id: parentId ?? null,
      })
      .select("*, profile:profiles!inner(username, avatar_url)")
      .single();

    if (error) throw error;

    return jsonOk(mapCommentRow(data as ReviewCommentRow & { profile: { username: string; avatar_url: string } }));
  } catch (err) {
    console.error("[API] /reviews/[id]/comments POST error:", err);
    return jsonError("Failed to add comment");
  }
}
