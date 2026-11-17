/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user's profile.
 */

import { jsonPrivateOk as jsonOk, jsonError } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/supabase/auth";
export const maxDuration = 30;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Not authenticated", 401);
  return jsonOk(user);
}
