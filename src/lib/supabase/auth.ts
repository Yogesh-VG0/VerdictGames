/**
 * VERDICT.GAMES — Supabase Auth Client (SSR)
 *
 * Uses @supabase/ssr for cookie-based auth in Next.js App Router.
 * Import this in server components and route handlers.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database, ProfileRow } from "./types";
import { getServerSupabase } from "./server";
import { currentHomepageSignal } from "@/lib/services/homepage-budget";

export async function getAuthSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: (input, init) => {
        const deadline = currentHomepageSignal();
        return fetch(input, deadline ? { ...init, signal: init?.signal ? AbortSignal.any([deadline, init.signal]) : deadline } : init);
      } },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can fail in Server Components — that's fine
          }
        },
      },
    }
  );
}

export class MissingProfileError extends Error {}

/** Get the currently authenticated user's profile, or null. */
export async function getCurrentUser({ strict = false }: { strict?: boolean } = {}, client?: Awaited<ReturnType<typeof getAuthSupabase>>) {
  try {
    const supabase = client ?? await getAuthSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (strict && authError && authError.name !== "AuthSessionMissingError"
      && authError.status !== 401 && authError.status !== 403
      && !["session_not_found", "refresh_token_not_found", "bad_jwt"].includes(authError.code ?? "")) throw authError;
    if (!user) return null;

    // Read private identity/role columns only after Auth has verified the
    // session. Never accept an auth ID or role from browser input/metadata.
    const profileClient = getServerSupabase();

    // Try fetching with `role` column first (migration 004); fall back without it.
    let resolvedProfile: (ProfileRow & { role?: string }) | null = null;

    const { data: profile, error: profileErr } = await profileClient
      .from("profiles")
      .select("id, username, display_name, avatar_url, role")
      .eq("auth_id", user.id)
      .maybeSingle() as { data: (ProfileRow & { role?: string }) | null; error: unknown };

    const missingRole = ['42703', 'PGRST204'].includes((profileErr as { code?: string } | null)?.code ?? '');
    if (strict && profileErr && !missingRole) throw profileErr;
    if (!profileErr && profile) {
      resolvedProfile = profile;
    } else if (profileErr) {
      // Older schemas may lack the role column.
      const { data: profileFallback, error: fallbackError } = await profileClient
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("auth_id", user.id)
        .maybeSingle() as { data: ProfileRow | null; error: unknown };
      if (strict && fallbackError) throw fallbackError;

      resolvedProfile = profileFallback;
    }
    if (!resolvedProfile) {
      const { data: profileById, error: legacyError } = await profileClient
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", user.id)
        .is("auth_id", null)
        .maybeSingle() as { data: ProfileRow | null; error: unknown };
      if (strict && legacyError) throw legacyError;
      resolvedProfile = profileById;
    }

    if (!resolvedProfile) {
      if (strict) throw new MissingProfileError("Verified session has no profile");
      return null;
    }

    return {
      id: user.id,
      email: user.email ?? "",
      profileId: resolvedProfile.id,
      username: resolvedProfile.username,
      displayName: resolvedProfile.display_name,
      avatar: resolvedProfile.avatar_url,
      role: (resolvedProfile.role as "user" | "admin") ?? "user",
    };
  } catch (error) {
    if (strict) throw error;
    return null;
  }
}
