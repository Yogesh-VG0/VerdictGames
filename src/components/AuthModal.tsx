/**
 * VERDICT.GAMES — Auth Modal
 *
 * Login / Sign-up modal with email + OAuth (Google, Discord).
 * Includes real-time username validation, password strength checks,
 * and a polished UI with show/hide toggle.
 */

"use client";

import { Suspense, useState, useRef, useEffect, useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { getUsernameValidationError, normalizeUsername, sanitizeUsername } from "@/lib/auth/username";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, X, CheckCircle2, AlertCircle, Loader2, User, Mail, Lock, ArrowLeft, ShieldCheck } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "login" | "signup";
  message?: string;
}

const PASSWORD_RE_LETTER = /[a-zA-Z]/;
const PASSWORD_RE_NUMBER = /[0-9]/;

type AuthView = "login" | "signup" | "forgot-password";

const inputCls = "w-full h-11 pl-10 pr-4 text-sm rounded-2xl bg-surface-2 border border-border text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all";
const inputIconCls = "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary pointer-events-none";
const secondaryButtonCls = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2 px-4 text-sm font-medium text-foreground hover:bg-elevated transition-colors disabled:opacity-50";

function AuthModalContent({ isOpen, onClose, defaultTab = "login", message }: AuthModalProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPath = useMemo(() => {
    const params = new URLSearchParams(searchParams?.toString());
    params.delete("auth_error");
    const query = params.toString();
    return `${pathname || "/"}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);
  const [view, setView] = useState<AuthView>(defaultTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const { signInWithEmail, signUpWithEmail, signInWithOAuth, sendPasswordResetEmail, resendConfirmationEmail } = useAuth();
  const [oauthLoading, setOauthLoading] = useState<"google" | "discord" | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Username availability check
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [usernameHint, setUsernameHint] = useState("");
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkUsername = useCallback(async (val: string) => {
    const clean = normalizeUsername(val);
    if (clean.length < 3) {
      setUsernameStatus("idle");
      setUsernameHint("");
      return null;
    }
    const validationError = getUsernameValidationError(clean);
    if (validationError) {
      setUsernameStatus("taken");
      setUsernameHint(validationError);
      return { available: false, reason: validationError };
    }
    setUsernameStatus("checking");
    try {
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(clean)}`);
      const json = await res.json();
      if (json.data?.available) {
        setUsernameStatus("available");
        setUsernameHint("Username is available");
        return { available: true, reason: null };
      } else {
        setUsernameStatus("taken");
        setUsernameHint(json.data?.reason || "Username is not available");
        return { available: false, reason: json.data?.reason || "Username is not available" };
      }
    } catch {
      setUsernameStatus("idle");
      setUsernameHint("");
      return null;
    }
  }, []);

  function handleUsernameChange(val: string) {
    const sanitized = sanitizeUsername(val);
    setUsername(sanitized);
    setUsernameStatus("idle");
    setUsernameHint("");
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (sanitized.length >= 3) {
      checkTimer.current = setTimeout(() => checkUsername(sanitized), 400);
    }
  }

  // Password strength
  const pwLen = password.length >= 8;
  const pwLetter = PASSWORD_RE_LETTER.test(password);
  const pwNumber = PASSWORD_RE_NUMBER.test(password);
  const pwValid = pwLen && pwLetter && pwNumber;
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;
  const heading = view === "login" ? "Welcome Back" : view === "signup" ? "Join Verdict.games" : "Reset your password";
  const subtitle = view === "login"
    ? "Sign in to your account"
    : view === "signup"
      ? "Create your gaming profile"
      : "Use your email to recover access securely.";
  const eyebrow = view === "login" ? "Secure sign in" : view === "signup" ? "Create account" : "Account recovery";
  const showResendConfirmation = (view === "signup" && !!successMsg && !!verificationEmail) || (view === "login" && error === "Please verify your email before signing in." && email.trim().length > 0);

  // Reset state on tab switch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setSuccessMsg("");
    setUsernameStatus("idle");
    setUsernameHint("");
    setResendLoading(false);
  }, [view]);

  // Reset everything when modal closes
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView(defaultTab);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setUsername("");
      setError("");
      setSuccessMsg("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setUsernameStatus("idle");
      setUsernameHint("");
      setOauthLoading(null);
      setResendLoading(false);
      setVerificationEmail("");
    }
  }, [defaultTab, isOpen]);

  // Focus trap + body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";

    // Focus first input after animation
    const timer = setTimeout(() => {
      const el = modalRef.current;
      if (el) {
        const firstInput = el.querySelector<HTMLElement>("input, button:not([tabindex='-1'])");
        firstInput?.focus();
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = "";
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  // Trap focus within modal
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key !== "Tab" || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, [onClose]);

  async function handleOAuth(provider: "google" | "discord") {
    setError("");
    setSuccessMsg("");
    setOauthLoading(provider);
    const result = await signInWithOAuth(provider, { nextPath: currentPath });
    setOauthLoading(null);
    if (result.error) setError(result.error);
  }

  async function handleResendConfirmation() {
    const targetEmail = verificationEmail || email;
    if (!targetEmail.trim()) {
      setError("Enter your email first.");
      return;
    }
    setError("");
    setSuccessMsg("");
    setResendLoading(true);
    const result = await resendConfirmationEmail(targetEmail, { nextPath: currentPath });
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMsg(`We sent a new confirmation link to ${targetEmail.trim().toLowerCase()}.`);
      setVerificationEmail(targetEmail.trim().toLowerCase());
    }
    setResendLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    if (view === "forgot-password") {
      const result = await sendPasswordResetEmail(email);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccessMsg("If an account exists for that email, a password reset link is on its way.");
      }
      setLoading(false);
      return;
    }

    if (view === "login") {
      const result = await signInWithEmail(email, password);
      if (result.error) setError(result.error);
      else onClose();
    } else {
      const cleanUsername = normalizeUsername(username);
      const usernameValidationError = getUsernameValidationError(cleanUsername);
      if (usernameValidationError) {
        setError(usernameValidationError);
        setLoading(false);
        return;
      }
      if (!pwValid) {
        setError("Password must be at least 8 characters with at least one letter and one number.");
        setLoading(false);
        return;
      }
      if (!passwordsMatch) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }
      // Check username availability one more time
      const availability = await checkUsername(cleanUsername);
      if (!availability) {
        setError("Couldn't verify that username right now. Please try again.");
        setLoading(false);
        return;
      }
      if (!availability.available) {
        setError(availability.reason || "Username is not available.");
        setLoading(false);
        return;
      }

      const result = await signUpWithEmail(email, password, cleanUsername, { nextPath: currentPath });
      if (result.error) {
        setError(result.error);
      } else {
        const normalizedEmail = email.trim().toLowerCase();
        setSuccessMsg("Account created! Check your email to verify your account before signing in.");
        setVerificationEmail(normalizedEmail);
        setEmail(normalizedEmail);
        setPassword("");
        setConfirmPassword("");
        setUsername("");
      }
    }
    setLoading(false);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            onKeyDown={handleKeyDown}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[28px] border border-border bg-surface p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-tertiary hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="mb-5 rounded-3xl border border-border bg-surface-2/80 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent/80">{eyebrow}</p>
                  <h2 id="auth-modal-title" className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
                    {heading}
                  </h2>
                  <p className="mt-1 text-sm text-secondary">{subtitle}</p>
                  {message && (
                    <p className="mt-2 text-sm text-accent">{message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* OAuth buttons */}
            {view !== "forgot-password" && (
              <>
                <div className="space-y-2.5 mb-4">
                  <button
                    type="button"
                    disabled={!!oauthLoading || loading}
                    onClick={() => handleOAuth("google")}
                    className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2 text-sm text-foreground hover:bg-elevated transition-colors disabled:opacity-50"
                  >
                    {oauthLoading === "google" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    )}
                    <span>{oauthLoading === "google" ? "Connecting..." : "Continue with Google"}</span>
                  </button>
                  <button
                    type="button"
                    disabled={!!oauthLoading || loading}
                    onClick={() => handleOAuth("discord")}
                    className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2 text-sm text-foreground hover:bg-elevated transition-colors disabled:opacity-50"
                  >
                    {oauthLoading === "discord" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                    )}
                    <span>{oauthLoading === "discord" ? "Connecting..." : "Continue with Discord"}</span>
                  </button>
                </div>

                <div className="relative my-4">
                  <hr className="border-border" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface px-3 text-xs text-tertiary">
                    or
                  </span>
                </div>

                {/* Tab switcher */}
                <div className="flex gap-1 p-1 rounded-2xl bg-surface-2 mb-4">
                  {(["login", "signup"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setView(t)}
                      className={cn(
                        "flex-1 py-2.5 text-sm font-medium rounded-xl transition-all",
                        view === t ? "bg-accent text-white" : "text-secondary hover:text-foreground"
                      )}
                    >
                      {t === "login" ? "Log In" : "Sign Up"}
                    </button>
                  ))}
                </div>
              </>
            )}

            {view === "forgot-password" && (
              <button
                type="button"
                onClick={() => setView("login")}
                className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-secondary hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to sign in</span>
              </button>
            )}

            {/* Success message */}
            {successMsg && (
              <div className="mb-4 space-y-3">
                <div role="status" aria-live="polite" className="flex items-start gap-2 rounded-2xl bg-success/10 border border-success/20 px-3 py-3 text-sm text-success">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
                {view === "signup" && verificationEmail && (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={resendLoading}
                    className={secondaryButtonCls}
                  >
                    {resendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    <span>{resendLoading ? "Sending..." : "Resend verification email"}</span>
                  </button>
                )}
                {view === "forgot-password" && (
                  <button type="button" onClick={() => setView("login")} className={secondaryButtonCls}>
                    Back to login
                  </button>
                )}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {view === "signup" && (
                <div className="space-y-1">
                  <div className="relative">
                    <User className={inputIconCls} />
                    <input
                      id="auth-username"
                      name="username"
                      type="text"
                      value={username}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      placeholder="Username"
                      aria-label="Username"
                      required
                      autoComplete="username"
                      className={cn(inputCls, "pr-9", usernameStatus === "available" && "border-success/50", usernameStatus === "taken" && "border-danger/50")}
                    />
                    {/* Status icon */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {usernameStatus === "checking" && <Loader2 className="w-4 h-4 text-tertiary animate-spin" />}
                      {usernameStatus === "available" && <CheckCircle2 className="w-4 h-4 text-success" />}
                      {usernameStatus === "taken" && <AlertCircle className="w-4 h-4 text-danger" />}
                    </div>
                  </div>
                  {usernameHint && (
                    <p className={cn("text-[11px] px-1", usernameStatus === "available" ? "text-success" : "text-danger")}>
                      {usernameHint}
                    </p>
                  )}
                  <p className="text-[11px] text-tertiary px-1">3-24 characters. Letters, numbers, and underscores only.</p>
                </div>
              )}

              <div className="relative">
                <Mail className={inputIconCls} />
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  aria-label="Email"
                  required
                  autoComplete="email"
                  className={inputCls}
                />
              </div>

              {view === "forgot-password" && (
                <p className="px-1 text-[11px] text-tertiary">
                  Use the email tied to your account. If it exists, we’ll send a secure reset link.
                </p>
              )}

              {view !== "forgot-password" && (
                <div className="space-y-1">
                <div className="relative">
                  <Lock className={inputIconCls} />
                  <input
                    id="auth-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    aria-label="Password"
                    required
                    autoComplete={view === "login" ? "current-password" : "new-password"}
                    className={cn(inputCls, "pr-10")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password strength indicators (signup only) */}
                {view === "signup" && password.length > 0 && (
                  <div className="flex items-center gap-3 px-1 pt-0.5">
                    <span className={cn("text-[11px]", pwLen ? "text-success" : "text-tertiary")}>
                      {pwLen ? "\u2713" : "\u2022"} 8+ chars
                    </span>
                    <span className={cn("text-[11px]", pwLetter ? "text-success" : "text-tertiary")}>
                      {pwLetter ? "\u2713" : "\u2022"} Letter
                    </span>
                    <span className={cn("text-[11px]", pwNumber ? "text-success" : "text-tertiary")}>
                      {pwNumber ? "\u2713" : "\u2022"} Number
                    </span>
                  </div>
                )}
              </div>
              )}

              {view === "signup" && (
                <div className="space-y-1">
                  <div className="relative">
                    <Lock className={inputIconCls} />
                    <input
                      id="auth-confirm-password"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      aria-label="Confirm password"
                      required
                      autoComplete="new-password"
                      className={cn(inputCls, "pr-10")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <p className={cn("px-1 text-[11px]", passwordsMatch ? "text-success" : "text-danger")}>
                      {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                    </p>
                  )}
                </div>
              )}

              {view === "login" && (
                <div className="flex justify-end px-1 -mt-1">
                  <button
                    type="button"
                    onClick={() => setView("forgot-password")}
                    className="text-sm font-medium text-accent hover:text-accent-hover transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {error && (
                <div className="space-y-3">
                  <div role="alert" aria-live="assertive" className="flex items-start gap-2 rounded-2xl bg-danger/10 border border-danger/20 px-3 py-3 text-sm text-danger">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                  {showResendConfirmation && (
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={resendLoading}
                      className={secondaryButtonCls}
                    >
                      {resendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      <span>{resendLoading ? "Sending..." : "Resend verification email"}</span>
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !!oauthLoading || resendLoading || (view === "signup" && usernameStatus === "checking")}
                className="w-full h-11 rounded-2xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {view === "login" ? "Signing in..." : view === "signup" ? "Creating account..." : "Sending reset link..."}
                  </>
                ) : (
                  view === "login" ? "Log In" : view === "signup" ? "Create Account" : "Send Reset Link"
                )}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function AuthModal(props: AuthModalProps) {
  return (
    <Suspense fallback={null}>
      <AuthModalContent {...props} />
    </Suspense>
  );
}
