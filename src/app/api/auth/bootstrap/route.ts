/**
 * POST /api/auth/bootstrap
 *
 * Ensures a `profiles` row exists for the authenticated Supabase user.
 * This is important for OAuth logins when DB triggers/migrations haven't been applied.
 */

import { NextResponse } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { getAuthSupabase } from "@/lib/supabase/auth";
import { getServerSupabase } from "@/lib/supabase/server";

export async function POST() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonError("Supabase not configured", 503);
    }

    const authSupabase = await getAuthSupabase();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return jsonError("Not authenticated", 401);

    const service = getServerSupabase();

    // Check if profile exists
    const { data: existing } = await service
      .from("profiles")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (existing) return jsonOk({ created: false });

    const email = user.email ?? "";
    const preferredUsername =
      (user.user_metadata?.preferred_username as string | undefined) ??
      (user.user_metadata?.full_name as string | undefined) ??
      email.split("@")[0] ??
      "user";

    // Note: local generated Supabase types may not include `auth_id` on Insert yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profilesTable = service.from("profiles") as any;
    const { error: insertErr } = await profilesTable.insert({
      auth_id: user.id,
      username: preferredUsername.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24) || "user",
      display_name: preferredUsername.slice(0, 32),
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? "",
      bio: "",
      favorite_genres: [],
    });

    if (insertErr) return jsonError(insertErr.message, 500);
    return jsonOk({ created: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}

