import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { gameId, featured, trending, manualScore } = await request.json();
  if (!gameId) return jsonError("gameId required", 400);

  const supabase = getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};
  if (typeof featured === "boolean") {
    updates.featured = featured;
    updates.is_featured_manual = featured;
  }
  if (typeof trending === "boolean") {
    updates.trending = trending;
    updates.is_trending_manual = trending;
  }
  if (typeof manualScore === "number") {
    updates.manual_score = Math.min(100, Math.max(0, manualScore));
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("Provide featured and/or trending", 400);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase.from("games") as any)
    .update(updates)
    .eq("id", gameId);

  if (updateErr) {
    return jsonError("Update failed: " + updateErr.message, 500);
  }

  return jsonOk({ updated: true });
}
