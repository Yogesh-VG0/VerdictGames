/**
 * VERDICT.GAMES — Auth Modal
 *
 * Login / Sign-up modal with email + OAuth (Google, Discord).
 */

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "login" | "signup";
  message?: string;
}

export default function AuthModal({ isOpen, onClose, defaultTab = "login", message }: AuthModalProps) {
  const [tab, setTab] = useState<"login" | "signup">(defaultTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signInWithEmail, signUpWithEmail } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (tab === "login") {
      const result = await signInWithEmail(email, password);
      if (result.error) setError(result.error);
      else onClose();
    } else {
      if (username.length < 3) {
        setError("Username must be at least 3 characters.");
        setLoading(false);
        return;
      }
      const result = await signUpWithEmail(email, password, username);
      if (result.error) setError(result.error);
      else {
        setError("");
        setTab("login");
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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-tertiary hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="text-center space-y-2 mb-6">
              <h2 className="text-xl font-bold text-foreground">
                {tab === "login" ? "Welcome Back" : "Join Verdict.games"}
              </h2>
              {message && (
                <p className="text-sm text-accent">{message}</p>
              )}
              <p className="text-xs text-tertiary">
                {tab === "login" ? "Sign in to your account" : "Create your gaming profile"}
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-4">
              {(["login", "signup"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(""); }}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                    tab === t ? "bg-accent text-white" : "text-secondary hover:text-foreground"
                  )}
                >
                  {t === "login" ? "Log In" : "Sign Up"}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {tab === "signup" && (
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  required
                  minLength={3}
                  maxLength={30}
                  className="w-full h-10 px-4 text-sm rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full h-10 px-4 text-sm rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                minLength={6}
                className="w-full h-10 px-4 text-sm rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
              />

              {error && (
                <p className="text-xs text-danger">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {loading ? "..." : tab === "login" ? "Log In" : "Create Account"}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
