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
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { id } = await params;
  const body = await request.json();
  const supabase = getServerSupabase();

  const allowedFields = [
    "title", "subtitle", "description", "score", "verdict_label", "verdict_summary",
    "pros", "cons", "monetization", "performance_notes", "monetization_notes",
    "featured", "trending", "genres", "tags", "platforms",
    "cover_image", "header_image", "steam_url", "trailer_url",
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

  updates.updated_at = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("games") as any)
    .update(updates)
    .eq("id", id);

  if (error) {
    return jsonError("Failed to update game: " + (error as Error).message, 500);
  }

  const { data: updated } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .maybeSingle() as { data: GameRow | null };

  return jsonOk(updated ? mapGameRow(updated) : null);
}
