/**
 * VERDICT.GAMES — Auth Context Provider
 *
 * Client-side auth state management using Supabase Auth.
 * Provides login/logout/signup methods and current user state.
 */

"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@supabase/ssr";
import type { AuthUser } from "@/lib/types";
import type { Database } from "@/lib/supabase/types";
import { loadOwnProfile } from '@/lib/auth/own-profile';
import { getPasswordValidationError } from '@/lib/auth/password';
import { getUsernameValidationError, normalizeUsername } from '@/lib/auth/username';
import { isEmailCode, normalizeEmailCode, type EmailCodePurpose } from '@/lib/auth/email-code';

interface AuthContextType {
  user: AuthUser | null;
  hasSession: boolean;
  sessionId: string | null;
  isPasswordRecovery: boolean;
  sessionEmail: string | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string, username: string, options?: { nextPath?: string }) => Promise<{ error?: string }>;
  signInWithOAuth: (provider: "google" | "discord", options?: { nextPath?: string }) => Promise<{ error?: string }>;
  sendPasswordResetEmail: (email: string) => Promise<{ error?: string }>;
  resendConfirmationEmail: (email: string, options?: { nextPath?: string }) => Promise<{ error?: string }>;
  verifyEmailCode: (email: string, code: string, purpose: EmailCodePurpose) => Promise<{ error?: string }>;
  verifyConfirmationLink: (tokenHash: string) => Promise<{ error?: string }>;
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
    return "Check your inbox for a verification link. If you already have an account, sign in or reset your password.";
  }

  if (normalizedMessage.includes("password should be at least")) {
    return "Use a unique password with at least 15 characters.";
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [supabase] = useState(() => getSupabaseBrowser());
  const queryClient = useQueryClient();
  const profileRequest = useRef(0);
  const pendingProfile = useRef<{ id: string; requestId: number; promise: Promise<void> } | null>(null);
  const activeAuthId = useRef<string | null>(null);
  const resolvedAuthId = useRef<string | null>(null);
  const activateIdentity = useCallback((id: string | null) => {
    if (activeAuthId.current === id) return;
    activeAuthId.current = id;
    resolvedAuthId.current = null;
    setSessionId(id);
    profileRequest.current++;
    pendingProfile.current = null;
    setProfileLoading(false);
    const privateScopes = new Set(['library', 'libraryStats', 'gameReviews', 'globalReviews', 'userReviews', 'personalized', 'privateLists']);
    const filters = { predicate: (query: { queryKey: readonly unknown[] }) => privateScopes.has(String(query.queryKey[0])) };
    void queryClient.cancelQueries(filters);
    queryClient.removeQueries(filters);
    setUser(null);
  }, [queryClient]);
  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  const fetchProfile = useCallback((authId: string, force = false) => {
    if (!force && resolvedAuthId.current === authId) return Promise.resolve();
    if (pendingProfile.current?.id === authId) return pendingProfile.current.promise;
    const requestId = ++profileRequest.current;
    setProfileLoading(true);
    const promise = (async () => {
    try {
      const profile = await loadOwnProfile(authId,
        () => requestId === profileRequest.current && activeAuthId.current === authId);
      if (profile) {
        resolvedAuthId.current = authId;
        setUser(profile);
      }
    } catch {
      // Leave the session available for retry without retaining another user's
      // profile or inferring an administrator role from editable metadata.
    } finally {
      if (pendingProfile.current?.requestId === requestId) {
        pendingProfile.current = null;
        setProfileLoading(false);
      }
    }
    })();
    pendingProfile.current = { id: authId, requestId, promise };
    return promise;
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!supabase) { setLoading(false); return; }

    // Use getSession() for instant local check (reads from storage, no network call).
    // Then await fetchProfile before clearing loading so user is populated first.
    let active = true;
    let receivedAuthEvent = false;
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!active || receivedAuthEvent) return;
      // Do not let a delayed initial refresh overwrite a newer sign-in/out.
      // The SDK owns token-refresh retries; avoid a second application loop.
      if (error) {setLoading(false);return;}
      if (session?.user) {
        activateIdentity(session.user.id);
        setHasSession(true);
        setSessionEmail(session.user.email ?? null);
        await fetchProfile(session.user.id);
      } else {
        activateIdentity(null);
        setHasSession(false);
        setSessionEmail(null);
        setUser(null);
      }
      if (active) setLoading(false);
    }).catch(() => {if (active) setLoading(false);});

    // Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      receivedAuthEvent = true;
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      } else if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setIsPasswordRecovery(false);
      }

      if (session?.user) {
        activateIdentity(session.user.id);
        setHasSession(true);
        setSessionEmail(session.user.email ?? null);
        void fetchProfile(session.user.id, event === "USER_UPDATED" || event === "TOKEN_REFRESHED");
      } else {
        activateIdentity(null);
        setHasSession(false);
        setSessionEmail(null);
        setUser(null);
      }
    });

    return () => {active = false;subscription.unsubscribe();};
  }, [supabase, fetchProfile, activateIdentity]);

  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: "Auth not configured" };
    const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
    if (error) return { error: mapAuthError(error.message, "login") };
    return {};
  };

  const signUpWithEmail = async (email: string, password: string, username: string, options?: { nextPath?: string }) => {
    if (!supabase) return { error: "Auth not configured" };
    const validationError = getPasswordValidationError(password) || getUsernameValidationError(username);
    if (validationError) return { error: validationError };
    const emailRedirectTo = buildAuthCallbackRedirect(options?.nextPath);
    const { error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        data: { preferred_username: normalizeUsername(username) },
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
    const validationError = getPasswordValidationError(password);
    if (validationError) return { error: validationError };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: mapAuthError(error.message, "password_update") };
    setIsPasswordRecovery(false);
    return {};
  };

  const verifyEmailCode = async (email: string, code: string, purpose: EmailCodePurpose) => {
    if (!supabase) return { error: 'Auth not configured' };
    if (!isEmailCode(code)) return { error: 'Enter the complete numeric code from your email.' };
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email), token: normalizeEmailCode(code), type: purpose,
    });
    if (error?.status === 429) return { error: 'Too many attempts. Please wait a minute before trying again.' };
    if (error || !data.session) return { error: 'This code is invalid or expired. Check the latest email or request a new code.' };
    setIsPasswordRecovery(purpose === 'recovery');
    return {};
  };

  const verifyConfirmationLink = async (tokenHash: string) => {
    if (!supabase) return { error: 'Auth not configured' };
    // Only email confirmation is accepted here; never trust a type/redirect
    // supplied by the link. The provider owns expiry and single-use checks.
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
    if (error?.status === 429) return { error: 'Too many attempts. Please wait a minute before trying again.' };
    if (error || !data.session) return { error: 'This confirmation link is invalid, expired or already used. Use the code from your latest email or request another confirmation.' };
    return {};
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    activateIdentity(null);
    setHasSession(false);
    setIsPasswordRecovery(false);
    setSessionEmail(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!supabase) return;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      activateIdentity(authUser.id);
      setHasSession(true);
      setSessionEmail(authUser.email ?? null);
      await fetchProfile(authUser.id, true);
    } else {
      activateIdentity(null);
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
        sessionId,
        isPasswordRecovery,
        sessionEmail,
        loading: loading || (!user && profileLoading),
        signInWithEmail,
        signUpWithEmail,
        signInWithOAuth,
        sendPasswordResetEmail,
        resendConfirmationEmail,
        verifyEmailCode,
        verifyConfirmationLink,
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
