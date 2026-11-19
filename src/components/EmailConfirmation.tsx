"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { readConfirmationToken } from '@/lib/auth/email-code';
import EmailCodeForm from './EmailCodeForm';

export default function EmailConfirmation() {
  const { verifyConfirmationLink } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [codeEmail, setCodeEmail] = useState('');
  const pending = useRef(false);
  const captured = useRef(false);

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
      {complete ? <CheckCircle2 className="mb-5 h-9 w-9 text-success" /> : <Mail className="mb-5 h-9 w-9 text-accent" />}
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{complete ? 'Email confirmed. You’re signed in.' : 'Confirm your email'}</h1>
      {complete ? <>
        <p role="status" className="mt-3 text-sm leading-6 text-secondary">You can close this tab. Your original signup tab will update automatically if it is in this browser.</p>
        <p className="mt-3 text-sm leading-6 text-secondary">On another device? You’re signed in here. Sign in separately on your other device.</p>
      </> : token ? <>
        <p className="mt-3 text-sm leading-6 text-secondary">Confirm your VerdictGames email and sign in to this browser. Only continue if you created this account.</p>
        {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
        <button type="button" onClick={confirm} disabled={!ready || !token || busy} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-action px-4 text-sm font-semibold text-action-foreground disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm email and sign in
        </button>
        <p className="mt-3 text-xs leading-5 text-secondary">This extra click prevents ordinary email-link previews from consuming your confirmation.</p>
        <button type="button" onClick={() => {setToken(null);setError('');}} disabled={busy} className="mt-4 text-sm font-medium text-accent">Use an email code instead</button>
      </> : codeEmail ? <div className="mt-5">
        <EmailCodeForm email={codeEmail} purpose="email" onVerified={() => setComplete(true)} onBack={() => setCodeEmail('')} />
      </div> : <form className="mt-5 space-y-4" onSubmit={event => {event.preventDefault();setCodeEmail(email.trim().toLowerCase());}}>
        <p className="text-sm leading-6 text-secondary">Enter your signup email, then the code from your latest email. You can read it on any device.</p>
        <div className="space-y-2">
          <label htmlFor="confirmation-email" className="block text-xs font-medium text-secondary">Email address</label>
          <input id="confirmation-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className="h-12 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50" />
        </div>
        <button type="submit" disabled={!ready} className="h-11 w-full rounded-2xl bg-action px-4 text-sm font-semibold text-action-foreground disabled:opacity-50">Enter confirmation code</button>
        <p className="text-xs leading-5 text-secondary">Use the code once, in the browser where you want to sign in. Returning to this page does not confirm an account by itself.</p>
      </form>}
      <Link href="/" className="mt-6 inline-block text-sm font-medium text-accent">Continue to Verdict.games</Link>
    </section>
  </div>;
}
