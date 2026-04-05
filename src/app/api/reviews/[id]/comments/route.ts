/**
 * GET /api/reviews/[id]/comments — Get comments on a review
 * POST /api/reviews/[id]/comments — Add a comment to a review
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError, jsonBadRequest } from "@/lib/api/response";
import { getAuthSupabase, getCurrentUser } from "@/lib/supabase/auth";
import { getPublicSupabase, hasPublicSupabaseEnv } from "@/lib/supabase/public";
import { mapCommentRow } from "@/lib/db/mappers";
import type { ReviewComment } from "@/lib/types";
import type { ReviewCommentRow } from "@/lib/supabase/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reviewId } = await params;
  const rawLimit = parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50;

  try {
    if (!hasPublicSupabaseEnv()) {
      return jsonOk([]);
    }

    const supabase = getPublicSupabase();

    const { data, error } = await supabase
      .from("review_comments")
      .select("*, profile:profiles!inner(username, avatar_url)")
      .eq("review_id", reviewId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;

    const flat = (data ?? []).map((row: unknown) =>
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
    const bodyText = typeof commentBody === "string" ? commentBody.trim() : "";
    const normalizedParentId = typeof parentId === "string" && parentId.trim().length > 0 ? parentId.trim() : null;

    if (bodyText.length === 0) {
      return jsonBadRequest("Comment body is required");
    }
    if (bodyText.length > 2000) {
      return jsonBadRequest("Comment must be 2000 characters or less");
    }

    const supabase = await getAuthSupabase();

    if (normalizedParentId) {
      const { data: parentComment, error: parentError } = await supabase
        .from("review_comments")
        .select("id")
        .eq("id", normalizedParentId)
        .eq("review_id", reviewId)
        .maybeSingle();

      if (parentError) throw parentError;
      if (!parentComment) return jsonBadRequest("Parent comment not found");
    }

    const { data, error } = await supabase
      .from("review_comments")
      .insert({
        review_id: reviewId,
        profile_id: user.profileId,
        body: bodyText,
        parent_id: normalizedParentId,
      })
      .select("*, profile:profiles!inner(username, avatar_url)")
      .single();

    if (error) throw error;

    return jsonOk(mapCommentRow(data as unknown as ReviewCommentRow & { profile: { username: string; avatar_url: string } }));
  } catch (err) {
    console.error("[API] /reviews/[id]/comments POST error:", err);
    return jsonError("Failed to add comment");
  }
}
