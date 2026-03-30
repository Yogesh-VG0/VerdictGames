/**
 * GET /api/auth/check-username?username=foo
 *
 * Returns whether a username is available and valid.
 * Used during signup to give real-time feedback.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { getPublicSupabase } from "@/lib/supabase/public";

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
const MIN_LEN = 3;
const MAX_LEN = 24;

const RESERVED = new Set([
  "admin", "administrator", "mod", "moderator", "system", "verdict",
  "verdictgames", "support", "help", "staff", "official", "root",
  "null", "undefined", "api", "www", "blog", "news",
]);

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("username")?.trim() ?? "";
  const username = raw.toLowerCase();

  if (!username) return jsonError("Username is required", 400);
  if (username.length < MIN_LEN) return jsonOk({ available: false, reason: `Must be at least ${MIN_LEN} characters` });
  if (username.length > MAX_LEN) return jsonOk({ available: false, reason: `Must be ${MAX_LEN} characters or fewer` });
  if (!USERNAME_RE.test(username)) return jsonOk({ available: false, reason: "Only letters, numbers, and underscores allowed" });
  if (RESERVED.has(username)) return jsonOk({ available: false, reason: "This username is reserved" });

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
