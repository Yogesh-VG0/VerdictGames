"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { readConfirmationToken } from '@/lib/auth/email-code';

export default function EmailConfirmation() {
  const { user, verifyConfirmationLink } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const captured = useRef(false);
  const alreadySignedIn = ready && !token && !!user;
  const finished = complete || alreadySignedIn;

  useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    // Fragments never reach request logs/referrers. Remove the secret from
    // browser history immediately and keep it only in this page's memory.
    const nextToken = readConfirmationToken(window.location.hash);
    window.history.replaceState(null, '', window.location.pathname);
    setToken(nextToken);
    setReady(true);
  }, []);

  async function confirm() {
    if (!token || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const result = await verifyConfirmationLink(token);
      if (result.error) setError(result.error);
      else { setComplete(true); setToken(null); }
    } catch { setError('Unable to confirm right now. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  }

  return <div className="mx-auto flex min-h-[65vh] w-full max-w-lg items-center px-4 py-12 sm:px-6">
    <section className="w-full rounded-[32px] border border-border bg-surface p-6 sm:p-8">
      {finished ? <CheckCircle2 className="mb-5 h-9 w-9 text-success" /> : <Mail className="mb-5 h-9 w-9 text-accent" />}
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{complete ? 'Email confirmed. You’re signed in.' : alreadySignedIn ? 'You’re already signed in.' : 'Confirm your email'}</h1>
      {finished ? <>
        <p role="status" className="mt-3 text-sm leading-6 text-secondary">You can close this tab. Your original signup tab will update automatically if it is in this browser.</p>
        <p className="mt-3 text-sm leading-6 text-secondary">On another device? You’re signed in here. Sign in separately on your other device.</p>
      </> : <>
        <p className="mt-3 text-sm leading-6 text-secondary">Confirm your VerdictGames email and sign in to this browser. Only continue if you created this account.</p>
        {ready && !token && <p role="alert" className="mt-4 text-sm text-danger">Open the link from your latest confirmation email, or enter its code in your original signup tab. If you refreshed this page, reopen the email link.</p>}
        {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
        <button type="button" onClick={confirm} disabled={!ready || !token || busy} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-action px-4 text-sm font-semibold text-action-foreground disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm email and sign in
        </button>
        <p className="mt-3 text-xs leading-5 text-secondary">This extra click prevents ordinary email-link previews from consuming your confirmation.</p>
      </>}
      <Link href="/" className="mt-6 inline-block text-sm font-medium text-accent">Continue to Verdict.games</Link>
    </section>
  </div>;
}
