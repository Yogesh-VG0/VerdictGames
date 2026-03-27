/**
 * VERDICT.GAMES — Admin Access Control
 *
 * Hardcoded admin email list + server-side guard for admin API routes.
 */

import { getCurrentUser } from "./supabase/auth";
import { jsonError } from "./api/response";
import { isAdminEmail } from "./adminEmails";

/**
 * Checks if the current request is from an admin user.
 * Returns the user if admin, or a JSON error response.
 */
export async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return { user: null, error: jsonError("Not authenticated", 401) };
  }

  // Allow access if DB role is 'admin' OR email is in the hardcoded allow-list.
  // This lets us manage admin access via DB without code deploys,
  // while keeping the email list as a fallback.
  if (user.role !== "admin" && !isAdminEmail(user.email)) {
    return { user: null, error: jsonError("Forbidden: admin access required", 403) };
  }

  return { user, error: null };
}
