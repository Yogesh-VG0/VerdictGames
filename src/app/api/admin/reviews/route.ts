import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/auditLog";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const supabase = getServerSupabase();
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  const { data, count } = await supabase
    .from("reviews")
    .select("*, profiles!inner(username, avatar_url), games!inner(title, slug, cover_image)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return jsonOk({
    reviews: data ?? [],
    total: count ?? 0,
    page,
    pageSize: limit,
  });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const { gameId, rating, title, bodyText, pros, cons, platform } = body;

  if (!gameId || !rating || !title || !bodyText) {
    return jsonError("Missing required fields: gameId, rating, title, bodyText", 400);
  }

  const supabase = getServerSupabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: insertErr } = await (supabase.from("reviews") as any).insert({
    game_id: gameId,
    profile_id: user!.profileId,
    rating: Math.min(100, Math.max(0, rating)),
    title,
    body: bodyText,
    pros: pros ?? [],
    cons: cons ?? [],
    platform: platform ?? "PC",
    helpful: 0,
  }).select("id").single();

  if (insertErr) {
    return jsonError("Failed to create review: " + insertErr.message, 500);
  }

  await writeAuditLog({
    entity_type: "review",
    entity_id: data.id,
    action: "create",
    field_changes: { game_id: { old: null, new: gameId }, rating: { old: null, new: rating }, title: { old: null, new: title } },
    edited_by: user?.email ?? "unknown",
  });

  return jsonOk({ id: data.id }, 201);
}

export async function DELETE(request: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { reviewId } = await request.json();
  if (!reviewId) return jsonError("reviewId required", 400);

  const supabase = getServerSupabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: delErr } = await (supabase.from("reviews") as any)
    .delete()
    .eq("id", reviewId);

  if (delErr) {
    return jsonError("Failed to delete review: " + delErr.message, 500);
  }

  await writeAuditLog({
    entity_type: "review",
    entity_id: reviewId,
    action: "delete",
    edited_by: user?.email ?? "unknown",
  });

  return jsonOk({ deleted: true });
}
