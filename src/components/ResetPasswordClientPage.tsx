"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const PASSWORD_RE_LETTER = /[a-zA-Z]/;
const PASSWORD_RE_NUMBER = /[0-9]/;
const inputCls = "w-full h-11 pl-10 pr-4 text-sm rounded-2xl bg-surface-2 border border-border text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all";

interface ResetPasswordClientPageProps {
  initialError?: string;
}

export default function ResetPasswordClientPage({ initialError }: ResetPasswordClientPageProps) {
  const router = useRouter();
  const { hasSession, sessionEmail, loading, updatePassword, sendPasswordResetEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [successMsg, setSuccessMsg] = useState("");

  const pwLen = password.length >= 8;
  const pwLetter = PASSWORD_RE_LETTER.test(password);
  const pwNumber = PASSWORD_RE_NUMBER.test(password);
  const pwValid = pwLen && pwLetter && pwNumber;
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!hasSession) {
      setError("This reset session is invalid or has expired. Request a fresh reset link below.");
      return;
    }

    if (!pwValid) {
      setError("Password must be at least 8 characters with at least one letter and one number.");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const result = await updatePassword(password);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMsg("Password updated. You're signed in and ready to continue.");
      setPassword("");
      setConfirmPassword("");
      window.setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1400);
    }
    setSubmitting(false);
  }

  async function handleSendAnotherLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const targetEmail = email.trim() || sessionEmail || "";

    if (!targetEmail) {
      setError("Enter your email first.");
      return;
    }

    setResending(true);
    const result = await sendPasswordResetEmail(targetEmail);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMsg("If an account exists for that email, a password reset link is on its way.");
    }
    setResending(false);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
      <div className="grid gap-6 lg:grid-cols-[1.08fr,0.92fr] lg:items-center">
        <section className="rounded-[32px] border border-border bg-surface p-6 shadow-xl sm:p-8 lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure account recovery
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Reset your password without the friction
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary sm:text-base">
            Choose a strong new password and get back to your profile fast. The recovery link is short-lived, your password only changes after you confirm it, and you&apos;ll stay signed in once it&apos;s updated.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-border bg-surface-2/70 p-4">
              <p className="text-sm font-semibold text-foreground">Fast recovery</p>
              <p className="mt-1 text-sm text-secondary">Use the link from your email to unlock this page instantly.</p>
            </div>
            <div className="rounded-3xl border border-border bg-surface-2/70 p-4">
              <p className="text-sm font-semibold text-foreground">Safer passwords</p>
              <p className="mt-1 text-sm text-secondary">We guide you toward a stronger password before you submit.</p>
            </div>
            <div className="rounded-3xl border border-border bg-surface-2/70 p-4">
              <p className="text-sm font-semibold text-foreground">No dead ends</p>
              <p className="mt-1 text-sm text-secondary">If a link expires, you can request another one right here.</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-secondary">
            <Link href="/" className="inline-flex items-center gap-2 font-medium text-foreground transition-colors hover:text-accent">
              <ArrowLeft className="h-4 w-4" />
              Back to verdict.games
            </Link>
            <span className="hidden h-1 w-1 rounded-full bg-border sm:block" />
            <span>Need your original inbox? Check spam, promotions, or social folders too.</span>
          </div>
        </section>

        <section className="rounded-[32px] border border-border bg-surface p-6 shadow-xl sm:p-8">
          {loading ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
              <div>
                <p className="text-base font-semibold text-foreground">Checking your recovery session</p>
                <p className="mt-1 text-sm text-secondary">This usually takes just a moment.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent/80">
                  {hasSession ? "Choose a new password" : "Request a fresh link"}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-foreground">
                  {hasSession ? "Finish resetting your password" : "Your link may have expired"}
                </h2>
                <p className="mt-2 text-sm text-secondary">
                  {hasSession
                    ? `Set a new password${sessionEmail ? ` for ${sessionEmail}` : ""} to secure your account.`
                    : "If the reset email is old or already used, send yourself another secure link below."}
                </p>
              </div>

              {successMsg && (
                <div role="status" aria-live="polite" className="mb-4 flex items-start gap-2 rounded-2xl border border-success/20 bg-success/10 px-3 py-3 text-sm text-success">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {error && (
                <div role="alert" aria-live="assertive" className="mb-4 flex items-start gap-2 rounded-2xl border border-danger/20 bg-danger/10 px-3 py-3 text-sm text-danger">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {hasSession ? (
                <form onSubmit={handleUpdatePassword} className="space-y-3.5">
                  <div className="space-y-1">
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary" />
                      <input
                        id="reset-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="New password"
                        autoComplete="new-password"
                        className={cn(inputCls, "pr-10")}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary transition-colors hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {password.length > 0 && (
                      <div className="flex flex-wrap items-center gap-3 px-1 pt-0.5">
                        <span className={cn("text-[11px]", pwLen ? "text-success" : "text-tertiary")}>{pwLen ? "✓" : "•"} 8+ chars</span>
                        <span className={cn("text-[11px]", pwLetter ? "text-success" : "text-tertiary")}>{pwLetter ? "✓" : "•"} Letter</span>
                        <span className={cn("text-[11px]", pwNumber ? "text-success" : "text-tertiary")}>{pwNumber ? "✓" : "•"} Number</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary" />
                      <input
                        id="reset-confirm-password"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                        className={cn(inputCls, "pr-10")}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary transition-colors hover:text-foreground"
                        aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPassword.length > 0 && (
                      <p className={cn("px-1 text-[11px]", passwordsMatch ? "text-success" : "text-danger")}>
                        {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Updating password...
                      </>
                    ) : (
                      "Update Password"
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSendAnotherLink} className="space-y-3.5">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary" />
                    <input
                      id="reset-email"
                      name="email"
                      type="email"
                      value={email || sessionEmail || ""}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      autoComplete="email"
                      className={inputCls}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resending}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                  >
                    {resending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending new link...
                      </>
                    ) : (
                      "Send New Reset Link"
                    )}
                  </button>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
