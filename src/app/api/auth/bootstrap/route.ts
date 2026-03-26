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

    // Check if profile exists. Prefer auth_id, but fall back to id if auth_id isn't available.
    const { data: existing, error: existingErr } = await service
      .from("profiles")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (existingErr) {
      const { data: existingById } = await service
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (existingById) return jsonOk({ created: false });
    }

    if (existing) return jsonOk({ created: false });

    const email = user.email ?? "";
    const preferredUsername =
      (user.user_metadata?.preferred_username as string | undefined) ??
      (user.user_metadata?.full_name as string | undefined) ??
      email.split("@")[0] ??
      "user";

    // Sanitize username: lowercase, strip invalid chars, enforce 3-24 chars
    let baseUsername = preferredUsername.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
    if (baseUsername.length < 3) baseUsername = "user";

    // Ensure uniqueness: check if username exists, append random suffix if taken
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profilesTable = service.from("profiles") as any;
    let finalUsername = baseUsername;
    const { data: existingUser } = await profilesTable
      .select("id")
      .eq("username", baseUsername)
      .maybeSingle();
    if (existingUser) {
      // Append random 4-digit suffix, retry up to 5 times
      for (let i = 0; i < 5; i++) {
        const suffix = Math.floor(1000 + Math.random() * 9000);
        const candidate = `${baseUsername.slice(0, 19)}_${suffix}`;
        const { data: dup } = await profilesTable
          .select("id")
          .eq("username", candidate)
          .maybeSingle();
        if (!dup) { finalUsername = candidate; break; }
      }
    }

    const rowBase = {
      username: finalUsername,
      display_name: preferredUsername.slice(0, 32),
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? "",
      bio: "",
      favorite_genres: [],
    };

    // Try inserting with auth_id (new schema). If it fails, fall back to id=user.id (older schema).
    let insertErr: { message?: string } | null = null;
    {
      const { error } = await profilesTable.insert({ ...rowBase, auth_id: user.id });
      insertErr = error ?? null;
    }
    if (insertErr) {
      const { error } = await profilesTable.insert({ ...rowBase, id: user.id });
      insertErr = error ?? null;
    }

    if (insertErr) return jsonError(insertErr.message ?? "Profile insert failed", 500);
    return jsonOk({ created: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}

