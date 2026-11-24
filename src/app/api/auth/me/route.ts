/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user's profile.
 */

import { jsonPrivateOk as jsonOk, jsonError } from "@/lib/api/response";
import { getCurrentUser, MissingProfileError } from "@/lib/supabase/auth";
import { boundedHomepageRead } from "@/lib/services/homepage-budget";
export const maxDuration = 10;

export async function GET() {
  try {
    const user = await boundedHomepageRead(4500, () => getCurrentUser({ strict: true }));
    if (!user) return jsonError("Not authenticated", 401);
    return jsonOk(user);
  } catch (error) {
    if (error instanceof MissingProfileError) return jsonError("Profile not found", 404);
    return jsonError("Profile temporarily unavailable", 503);
  }
}
