/**
 * VERDICT.GAMES — Supabase Auth Client (SSR)
 *
 * Uses @supabase/ssr for cookie-based auth in Next.js App Router.
 * Import this in server components and route handlers.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database, ProfileRow } from "./types";

export async function getAuthSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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

/** Get the currently authenticated user's profile, or null. */
export async function getCurrentUser() {
  try {
    const supabase = await getAuthSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Try fetching with `role` column first (migration 004); fall back without it.
    let resolvedProfile: (ProfileRow & { role?: string }) | null = null;

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, role")
      .eq("auth_id", user.id)
      .maybeSingle() as { data: (ProfileRow & { role?: string }) | null; error: unknown };

    if (!profileErr && profile) {
      resolvedProfile = profile;
    } else {
      // Fallback: role column may not exist, or auth_id lookup failed
      const { data: profileFallback } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("auth_id", user.id)
        .maybeSingle() as { data: ProfileRow | null };

      if (!profileFallback) {
        // Try by id (legacy schema)
        const { data: profileById } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle() as { data: ProfileRow | null };
        resolvedProfile = profileById;
      } else {
        resolvedProfile = profileFallback;
      }
    }

    if (!resolvedProfile) return null;

    return {
      id: user.id,
      email: user.email ?? "",
      profileId: resolvedProfile.id,
      username: resolvedProfile.username,
      displayName: resolvedProfile.display_name,
      avatar: resolvedProfile.avatar_url,
      role: (resolvedProfile.role as "user" | "admin") ?? "user",
    };
  } catch {
    return null;
  }
}
