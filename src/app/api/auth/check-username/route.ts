/**
 * GET /api/auth/check-username?username=foo
 *
 * Returns whether a username is available and valid.
 * Used during signup to give real-time feedback.
 */

import { NextRequest } from "next/server";
import { jsonPrivateOk, jsonError } from "@/lib/api/response";
import { getPublicSupabase } from "@/lib/supabase/public";
import { getUsernameValidationError, normalizeUsername } from "@/lib/auth/username";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("username")?.trim() ?? "";
  const username = normalizeUsername(raw);

  if (!username) return jsonError("Username is required", 400);
  const validationError = getUsernameValidationError(username);
  if (validationError) return jsonPrivateOk({ available: false, reason: validationError });

  try {
  const supabase = getPublicSupabase();
  const { data: existing, error } = await supabase.from("profiles")
    .select("id")
    // Escape LIKE wildcards: underscores are valid literal username characters.
    .ilike("username", username.replaceAll('_', '\\_'))
    .limit(1)
    .abortSignal(AbortSignal.timeout(2500))
    .maybeSingle();

  if (error) return jsonError("Temporarily unable to verify username. Please retry.", 503);

  if (existing) {
    return jsonPrivateOk({ available: false, reason: "Username is already taken" });
  }

  return jsonPrivateOk({ available: true, reason: null });
  } catch {
    return jsonError("Temporarily unable to verify username. Please retry.", 503);
  }
}
