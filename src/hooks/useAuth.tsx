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
  hasSession: boolean;
  isPasswordRecovery: boolean;
  sessionEmail: string | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string, username: string, options?: { nextPath?: string }) => Promise<{ error?: string }>;
  signInWithOAuth: (provider: "google" | "discord", options?: { nextPath?: string }) => Promise<{ error?: string }>;
  sendPasswordResetEmail: (email: string) => Promise<{ error?: string }>;
  resendConfirmationEmail: (email: string, options?: { nextPath?: string }) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

type AuthAction = "login" | "signup" | "oauth" | "password_reset" | "password_update" | "resend_confirmation";

function getSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient<Database>(url, key);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeNextPath(nextPath?: string) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }
  return nextPath;
}

function buildAuthCallbackRedirect(nextPath?: string) {
  if (typeof window === "undefined") return undefined;
  const redirectUrl = new URL("/api/auth/callback", window.location.origin);
  redirectUrl.searchParams.set("next", normalizeNextPath(nextPath));
  return redirectUrl.toString();
}

function buildPasswordResetRedirect() {
  if (typeof window === "undefined") return undefined;
  const redirectUrl = new URL("/api/auth/callback", window.location.origin);
  redirectUrl.searchParams.set("next", "/reset-password");
  redirectUrl.searchParams.set("flow", "recovery");
  return redirectUrl.toString();
}

function mapAuthError(message: string, action: AuthAction) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "Please verify your email before signing in.";
  }

  if (normalizedMessage.includes("user already registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }

  if (normalizedMessage.includes("password should be at least")) {
    return "Use a stronger password with at least 8 characters, one letter, and one number.";
  }

  if (normalizedMessage.includes("same password")) {
    return "Choose a new password you haven't used recently.";
  }

  if (normalizedMessage.includes("auth session missing") || normalizedMessage.includes("session missing")) {
    if (action === "password_update") {
      return "This reset session is invalid or has expired. Request a fresh reset link below.";
    }
    return "Your session expired. Please sign in again.";
  }

  if (normalizedMessage.includes("expired") && action === "password_update") {
    return "This reset link has expired. Request a fresh reset link below.";
  }

  if (normalizedMessage.includes("unable to validate email address") || normalizedMessage.includes("invalid email")) {
    return "Enter a valid email address.";
  }

  if (
    normalizedMessage.includes("email rate limit exceeded") ||
    normalizedMessage.includes("too many requests") ||
    normalizedMessage.includes("rate limit") ||
    normalizedMessage.includes("security purposes")
  ) {
    if (action === "password_reset" || action === "resend_confirmation") {
      return "Too many emails were requested. Please wait a few minutes and try again.";
    }
    return "Too many attempts. Please wait a minute and try again.";
  }

  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase] = useState(() => getSupabaseBrowser());
  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!supabase) { setLoading(false); return; }

    // Use getSession() for instant local check (reads from storage, no network call).
    // Then await fetchProfile before clearing loading so user is populated first.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setHasSession(true);
        setSessionEmail(session.user.email ?? null);
        await fetchProfile(session.user.id, session.user.email ?? "");
      } else {
        setHasSession(false);
        setSessionEmail(null);
        setUser(null);
      }
      setLoading(false);
    });

    // Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      } else if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setIsPasswordRecovery(false);
      }

      if (session?.user) {
        setHasSession(true);
        setSessionEmail(session.user.email ?? null);
        fetchProfile(session.user.id, session.user.email ?? "");
      } else {
        setHasSession(false);
        setSessionEmail(null);
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: "Auth not configured" };
    const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
    if (error) return { error: mapAuthError(error.message, "login") };
    return {};
  };

  const signUpWithEmail = async (email: string, password: string, username: string, options?: { nextPath?: string }) => {
    if (!supabase) return { error: "Auth not configured" };
    const emailRedirectTo = buildAuthCallbackRedirect(options?.nextPath);
    const { error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        data: { preferred_username: username },
        emailRedirectTo,
      },
    });
    if (error) return { error: mapAuthError(error.message, "signup") };
    return {};
  };

  const signInWithOAuth = async (provider: "google" | "discord", options?: { nextPath?: string }) => {
    if (!supabase) return { error: "Auth not configured" };
    const redirectTo = buildAuthCallbackRedirect(options?.nextPath);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });
    if (error) return { error: mapAuthError(error.message, "oauth") };
    return {};
  };

  const sendPasswordResetEmail = async (email: string) => {
    if (!supabase) return { error: "Auth not configured" };
    const redirectTo = buildPasswordResetRedirect();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), redirectTo ? { redirectTo } : undefined);
    if (error) return { error: mapAuthError(error.message, "password_reset") };
    return {};
  };

  const resendConfirmationEmail = async (email: string, options?: { nextPath?: string }) => {
    if (!supabase) return { error: "Auth not configured" };
    const emailRedirectTo = buildAuthCallbackRedirect(options?.nextPath);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizeEmail(email),
      options: {
        emailRedirectTo,
      },
    });
    if (error) return { error: mapAuthError(error.message, "resend_confirmation") };
    return {};
  };

  const updatePassword = async (password: string) => {
    if (!supabase) return { error: "Auth not configured" };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: mapAuthError(error.message, "password_update") };
    setIsPasswordRecovery(false);
    return {};
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setHasSession(false);
    setIsPasswordRecovery(false);
    setSessionEmail(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!supabase) return;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      setHasSession(true);
      setSessionEmail(authUser.email ?? null);
      await fetchProfile(authUser.id, authUser.email ?? "");
    } else {
      setHasSession(false);
      setSessionEmail(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        hasSession,
        isPasswordRecovery,
        sessionEmail,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithOAuth,
        sendPasswordResetEmail,
        resendConfirmationEmail,
        updatePassword,
        clearPasswordRecovery,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
