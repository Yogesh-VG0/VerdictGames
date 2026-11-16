/**
 * GET /api/library — Get user's game library
 * POST /api/library — Add/update a game in library
 * DELETE /api/library — Remove a game from library
 */

import { NextRequest } from "next/server";
import { jsonPrivateOk as jsonOk, jsonError, jsonBadRequest } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { mapUserGameRow } from "@/lib/db/mappers";
import { GAME_CARD_COLUMNS } from "@/lib/db/columns";
import type { GameRow, UserGameRow } from "@/lib/supabase/types";
import { buildLibraryPatch } from "@/lib/utils/libraryPatch";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Not authenticated", 401);

  const params = request.nextUrl.searchParams;
  const status = params.get("status");

  try {
    const supabase = getServerSupabase();
    let query = supabase
      .from("user_games")
      .select(`*, game:games!inner(${GAME_CARD_COLUMNS})`)
      .eq("user_id", user.profileId)
      .order("updated_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const items = (data ?? []).map((row: unknown) =>
      mapUserGameRow(row as UserGameRow & { game: GameRow })
    );

    return jsonOk(items);
  } catch (err) {
    const code=err && typeof err==='object' && 'code' in err && typeof err.code==='string'
      && /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(err.code) ? err.code : 'UNKNOWN';
    console.error("[API] /library GET failed", {code});
    return jsonError("Library is temporarily unavailable. Please retry.",503);
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Not authenticated", 401);

  try {
    const body = await request.json();
    const { gameId } = body;
    if (typeof gameId !== 'string' || !/^[a-f0-9-]{36}$/i.test(gameId)) return jsonBadRequest("Valid gameId is required");
    let patch;
    try { patch = buildLibraryPatch(body); }
    catch (error) { return jsonBadRequest((error as Error).message); }
    if (Object.keys(patch).length === 0) return jsonBadRequest('No library changes provided');

    const supabase = getServerSupabase();

    // Update only supplied fields atomically; do not read-and-rewrite private
    // values, which also loses concurrent edits. New rows use database defaults.
    const updateExisting = () => supabase.from('user_games').update(patch)
      .eq('user_id', user.profileId).eq('game_id', gameId)
      .select('*, game:games!inner(*)').maybeSingle();
    let result = await updateExisting();
    if (result.error) throw result.error;
    if (!result.data) {
      result = await supabase.from('user_games').insert({ user_id: user.profileId, game_id: gameId, status: 'wishlist', ...patch })
        .select('*, game:games!inner(*)').single();
      // A concurrent first insert won. Apply only this request's fields.
      if (result.error?.code === '23505') result = await updateExisting();
    }
    if (result.error || !result.data) throw result.error ?? new Error('Library update returned no row');
    return jsonOk(mapUserGameRow(result.data as unknown as UserGameRow & { game: GameRow }));
  } catch (err) {
    console.error("[API] /library POST error:", err);
    return jsonError("Failed to update library");
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Not authenticated", 401);

  try {
    const body = await request.json();
    const { gameId } = body;
    if (!gameId) return jsonBadRequest("gameId is required");

    const supabase = getServerSupabase();

    const { error } = await supabase
      .from("user_games")
      .delete()
      .eq("user_id", user.profileId)
      .eq("game_id", gameId);

    if (error) throw error;

    return jsonOk({ removed: true });
  } catch (err) {
    console.error("[API] /library DELETE error:", err);
    return jsonError("Failed to remove from library");
  }
}
