/**
 * VERDICT.GAMES — Auth Context Provider
 *
 * Client-side auth state management using Supabase Auth.
 * Provides login/logout/signup methods and current user state.
 */

"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { AuthUser } from "@/lib/types";
import type { Database } from "@/lib/supabase/types";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string, username: string) => Promise<{ error?: string }>;
  signInWithOAuth: (provider: "google" | "discord") => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient<Database>(url, key);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseBrowser();

  const fetchProfile = useCallback(async (authId: string, email: string) => {
    if (!supabase) return;
    // Try `auth_id` first (newer schema). If API returns 400, fall back to `id` (older schema).
    // NOTE: `role` may not exist in some deployed DBs yet (would cause PostgREST 400).
    // Try fetching with `role` column (migration 004); fall back without it.
    type ProfileData = { id: string; username: string; display_name: string; avatar_url: string; role?: string };
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, role")
      .eq("auth_id", authId)
      .maybeSingle();

    let resolvedProfile: ProfileData | null = profile as ProfileData | null;
    if (profileErr) {
      // role column may not exist yet, retry without it
      const { data: profileNoRole, error: profileNoRoleErr } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("auth_id", authId)
        .maybeSingle();
      resolvedProfile = profileNoRole as ProfileData | null;
      if (profileNoRoleErr) {
        const { data: profileById } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("id", authId)
          .maybeSingle();
        resolvedProfile = profileById as ProfileData | null;
      }
    }

    if (!resolvedProfile) {
      // If OAuth succeeded but profile doesn't exist yet, bootstrap it server-side.
      try {
        await fetch("/api/auth/bootstrap", { method: "POST" });
        const { data: profile2, error: profile2Err } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, role")
          .eq("auth_id", authId)
          .maybeSingle();
        let bootProfile: ProfileData | null = profile2 as ProfileData | null;
        if (profile2Err) {
          const { data: profile2ById } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .eq("id", authId)
            .maybeSingle();
          bootProfile = (profile2ById ?? null) as ProfileData | null;
        }
        if (!bootProfile) return;
        setUser({
          id: authId,
          email,
          profileId: bootProfile.id,
          username: bootProfile.username,
          displayName: bootProfile.display_name,
          avatar: bootProfile.avatar_url,
          role: bootProfile.role === "admin" ? "admin" : "user",
        });
      } catch {
        return;
      }
      return;
    }

    setUser({
      id: authId,
      email,
      profileId: resolvedProfile.id,
      username: resolvedProfile.username,
      displayName: resolvedProfile.display_name,
      avatar: resolvedProfile.avatar_url,
      role: resolvedProfile.role === "admin" ? "admin" : "user",
    });
  }, [supabase]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    // Use getSession() for instant local check (reads from storage, no network call).
    // Then await fetchProfile before clearing loading so user is populated first.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email ?? "");
      }
      setLoading(false);
    });

    // Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email ?? "");
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: "Auth not configured" };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const signUpWithEmail = async (email: string, password: string, username: string) => {
    if (!supabase) return { error: "Auth not configured" };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { preferred_username: username },
      },
    });
    if (error) return { error: error.message };
    return {};
  };

  const signInWithOAuth = async (provider: "google" | "discord") => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  };

  const refreshUser = async () => {
    if (!supabase) return;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await fetchProfile(authUser.id, authUser.email ?? "");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithEmail, signUpWithEmail, signInWithOAuth, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
