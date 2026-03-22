import { NextRequest } from "next/server";
import { jsonOk, jsonError, jsonNotFound } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { mapGameRow } from "@/lib/db/mappers";
import type { GameRow } from "@/lib/supabase/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const supabase = getServerSupabase();

  const { data } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .maybeSingle() as { data: GameRow | null };

  if (!data) return jsonNotFound("Game");
  return jsonOk(mapGameRow(data));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { id } = await params;
  const body = await request.json();
  const supabase = getServerSupabase();

  const allowedFields = [
    "title", "subtitle", "description", "score", "verdict_label", "verdict_summary",
    "pros", "cons", "monetization", "performance_notes", "monetization_notes",
    "featured", "trending", "genres", "tags", "platforms",
    "cover_image", "header_image", "steam_url", "trailer_url",
    "screenshots", "trailer_thumbnail", "developer", "publisher",
    "release_date", "franchise", "website_url", "wikipedia_url",
    "metacritic_url", "reddit_url", "igdb_url", "play_store_url",
    "is_provisional", "release_status",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("No valid fields to update", 400);
  }

  // Fetch old values for audit diff
  const { data: oldGame } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .maybeSingle() as { data: GameRow | null };

  if (!oldGame) return jsonNotFound("Game");

  updates.updated_at = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("games") as any)
    .update(updates)
    .eq("id", id);

  if (error) {
    return jsonError("Failed to update game: " + (error as Error).message, 500);
  }

  // Write audit log — diff changed fields
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fieldChanges: Record<string, { old: any; new: any }> = {};
    for (const key of Object.keys(updates)) {
      if (key === "updated_at") continue;
      const oldVal = (oldGame as Record<string, unknown>)[key];
      const newVal = updates[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        // Skip logging fields where both old and new are empty/null
        const oldEmpty = oldVal === null || oldVal === undefined || oldVal === "" || (Array.isArray(oldVal) && oldVal.length === 0);
        const newEmpty = newVal === null || newVal === undefined || newVal === "" || (Array.isArray(newVal) && newVal.length === 0);
        if (oldEmpty && newEmpty) continue;
        fieldChanges[key] = { old: oldVal, new: newVal };
      }
    }
    if (Object.keys(fieldChanges).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("admin_audit_log") as any).insert({
        entity_type: "game",
        entity_id: id,
        action: "update",
        field_changes: fieldChanges,
        edited_by: user?.email ?? "unknown",
        reason: body._reason || null,
      });
    }
  } catch { /* audit write is best-effort */ }

  const { data: updated } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .maybeSingle() as { data: GameRow | null };

  return jsonOk(updated ? mapGameRow(updated) : null);
}
