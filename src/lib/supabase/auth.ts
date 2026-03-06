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

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_id", user.id)
      .maybeSingle() as { data: ProfileRow | null };

    if (!profile) return null;

    return {
      id: user.id,
      email: user.email ?? "",
      profileId: profile.id,
      username: profile.username,
      displayName: profile.display_name,
      avatar: profile.avatar_url,
    };
  } catch {
    return null;
  }
}
