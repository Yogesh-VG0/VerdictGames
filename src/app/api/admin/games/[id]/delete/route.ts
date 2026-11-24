/**
 * DELETE /api/admin/games/[id]/delete
 *
 * Permanently deletes a game from the database.
 * Admin-only. Existing foreign keys cascade dependent records atomically.
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

  // Commit the game and its cascading deletes in one statement.
  const { data: game, error: deleteErr } = await supabase
    .from("games")
    .delete()
    .eq("id", id)
    .select("id, slug, title")
    .maybeSingle();

  if (deleteErr) {
    return jsonError(`Failed to delete game: ${deleteErr.message}`, 500);
  }

  if (!game) {
    return jsonError("Game not found", 404);
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
