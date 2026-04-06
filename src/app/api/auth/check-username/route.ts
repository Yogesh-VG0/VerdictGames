/**
 * GET /api/auth/check-username?username=foo
 *
 * Returns whether a username is available and valid.
 * Used during signup to give real-time feedback.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { getPublicSupabase } from "@/lib/supabase/public";
import { getUsernameValidationError, normalizeUsername } from "@/lib/auth/username";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("username")?.trim() ?? "";
  const username = normalizeUsername(raw);

  if (!username) return jsonError("Username is required", 400);
  const validationError = getUsernameValidationError(username);
  if (validationError) return jsonOk({ available: false, reason: validationError });

  const supabase = getPublicSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from("profiles") as any)
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existing) {
    return jsonOk({ available: false, reason: "Username is already taken" });
  }

  return jsonOk({ available: true, reason: null });
}
