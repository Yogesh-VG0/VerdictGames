/**
 * GET /api/library — Get user's game library
 * POST /api/library — Add/update a game in library
 * DELETE /api/library — Remove a game from library
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError, jsonBadRequest } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { mapUserGameRow } from "@/lib/db/mappers";
import type { GameRow, UserGameRow } from "@/lib/supabase/types";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Not authenticated", 401);

  const params = request.nextUrl.searchParams;
  const status = params.get("status");

  try {
    const supabase = getServerSupabase();
    let query = supabase
      .from("user_games")
      .select("*, game:games!inner(*)")
      .eq("user_id", user.profileId)
      .order("updated_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const items = (data ?? []).map((row: Record<string, unknown>) =>
      mapUserGameRow(row as UserGameRow & { game: GameRow })
    );

    return jsonOk(items);
  } catch (err) {
    console.error("[API] /library GET error:", err);
    return jsonOk([]);
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Not authenticated", 401);

  try {
    const body = await request.json();
    const { gameId, status, personalRating, hoursPlayed, notes, startedAt, completedAt } = body;

    if (!gameId) return jsonBadRequest("gameId is required");

    const validStatuses = ["wishlist", "playing", "completed", "dropped", "paused"];
    if (status && !validStatuses.includes(status)) {
      return jsonBadRequest("Invalid status");
    }

    const supabase = getServerSupabase();

    const { data, error } = await supabase
      .from("user_games")
      .upsert(
        {
          user_id: user.profileId,
          game_id: gameId,
          status: status ?? "wishlist",
          personal_rating: personalRating ?? null,
          hours_played: hoursPlayed ?? 0,
          notes: notes ?? "",
          started_at: startedAt ?? null,
          completed_at: completedAt ?? null,
        },
        { onConflict: "user_id,game_id" }
      )
      .select("*, game:games!inner(*)")
      .single();

    if (error) throw error;

    return jsonOk(mapUserGameRow(data as UserGameRow & { game: GameRow }));
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
