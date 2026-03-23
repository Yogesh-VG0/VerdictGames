/**
 * DELETE /api/admin/games/[id]/delete
 *
 * Permanently deletes a game from the database.
 * Admin-only. Also removes related list_items and source_mappings.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/auditLog";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { id } = await params;
  const supabase = getServerSupabase();

  // Fetch game info for audit log
  const { data: game } = await supabase
    .from("games")
    .select("id, slug, title")
    .eq("id", id)
    .maybeSingle();

  if (!game) {
    return jsonError("Game not found", 404);
  }

  // Delete related records first (foreign key constraints)
  await supabase.from("list_items").delete().eq("game_id", id);
  await supabase.from("source_mappings").delete().eq("game_id", id);
  await supabase.from("user_games").delete().eq("game_id", id);

  // Delete the game itself
  const { error: deleteErr } = await supabase
    .from("games")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    return jsonError(`Failed to delete game: ${deleteErr.message}`, 500);
  }

  await writeAuditLog({
    entity_type: "game",
    entity_id: id,
    action: "delete",
    field_changes: {
      title: { old: game.title, new: null },
      slug: { old: game.slug, new: null },
    },
    edited_by: user?.email ?? "unknown",
  });

  return jsonOk({ deleted: true, slug: game.slug, title: game.title });
}
