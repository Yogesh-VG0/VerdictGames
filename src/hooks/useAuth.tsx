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
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseBrowser();

  const fetchProfile = useCallback(async (authId: string, email: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("auth_id", authId)
      .maybeSingle();

    if (profile) {
      setUser({
        id: authId,
        email,
        profileId: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        avatar: profile.avatar_url,
      });
    }
  }, [supabase]);

  useEffect(() => {
    // Check initial session
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        fetchProfile(authUser.id, authUser.email ?? "");
      }
      setLoading(false);
    });

    // Listen for auth changes
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const signUpWithEmail = async (email: string, password: string, username: string) => {
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
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const refreshUser = async () => {
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
