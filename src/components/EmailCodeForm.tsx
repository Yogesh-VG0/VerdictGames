"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { OTPInput, REGEXP_ONLY_DIGITS } from 'input-otp';
import { useAuth } from '@/hooks/useAuth';
import { isEmailCode, normalizeEmailCode, type EmailCodePurpose } from '@/lib/auth/email-code';

interface EmailCodeFormProps {
  email: string;
  purpose: EmailCodePurpose;
  onVerified: () => void;
  onBack: () => void;
}

export default function EmailCodeForm({ email, purpose, onVerified, onBack }: EmailCodeFormProps) {
  const { verifyEmailCode, sendPasswordResetEmail, resendConfirmationEmail } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const deadline = useRef(0);
  const pending = useRef(false);
  const codeId = useId();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    deadline.current = Date.now() + 60_000;
    const timer = setInterval(() => setSeconds(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, []);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    if (!isEmailCode(code)) {
      setError('Enter the complete numeric code from your email.');
      input.current?.focus();
      return;
    }
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = await verifyEmailCode(email, code, purpose);
      if (result.error) {
        setError(result.error);
        input.current?.focus();
      } else {
        setCode('');
        onVerified();
      }
    } catch { setError('Unable to verify right now. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  }

  async function resend() {
    if (pending.current || Date.now() < deadline.current) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = purpose === 'recovery' ? await sendPasswordResetEmail(email) : await resendConfirmationEmail(email);
      if (result.error) setError(result.error);
      else {
        setCode(''); deadline.current = Date.now() + 60_000; setSeconds(60);
        input.current?.focus();
        setNotice('If this email is eligible, a fresh code is on its way. Use the latest email.');
      }
    } catch { setError('Unable to resend right now. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  }

  return <form onSubmit={verify} className="space-y-4">
    <p className="break-words text-sm text-secondary">Enter the code sent to <span className="font-medium text-foreground">{email}</span>. You can read the email on any device.</p>
    <div className="space-y-2">
      <label htmlFor={codeId} className="block text-xs font-medium text-secondary">Email verification code</label>
      <OTPInput
        ref={input}
        id={codeId}
        name="verificationCode"
        value={code}
        onChange={value => { setCode(value); setError(''); }}
        maxLength={10}
        minLength={6}
        pattern={REGEXP_ONLY_DIGITS}
        pasteTransformer={normalizeEmailCode}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        required
        readOnly={busy}
        spellCheck={false}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${codeId}-help ${codeId}-error` : `${codeId}-help`}
        render={({ slots }) => (
          <div aria-hidden="true" className="grid w-full gap-1.5 sm:gap-2"
            style={{ gridTemplateColumns: `repeat(${Math.max(6, code.length)}, minmax(0, 1fr))` }}>
            {slots.slice(0, Math.max(6, code.length)).map(({ char, isActive, hasFakeCaret }, index) => (
              <div key={index}
                className={`relative grid h-12 min-w-0 place-items-center rounded-xl border text-lg font-semibold tabular-nums leading-none motion-safe:transition-colors sm:h-14 sm:text-xl ${isActive
                  ? 'border-accent bg-accent/10 text-foreground ring-2 ring-accent/40'
                  : char ? 'border-accent/35 bg-surface text-foreground' : 'border-border bg-surface-2 text-secondary'}`}>
                {char ?? <span className="size-1 rounded-full bg-current opacity-35" />}
                {hasFakeCaret && <span className="absolute h-5 w-px bg-accent motion-safe:animate-pulse" />}
              </div>
            ))}
          </div>
        )}
      />
      <p id={`${codeId}-help`} className="text-xs leading-5 text-secondary">{purpose === 'email'
        ? 'Use the latest code once, in this browser. Already confirmed elsewhere? Sign in here with your password.'
        : 'Use the latest code once. If you verified it in another browser, finish there or request a fresh code here.'}</p>
    </div>
    {error && <p id={`${codeId}-error`} role="alert" className="text-sm text-danger">{error}</p>}
    {notice && <p role="status" className="text-sm text-secondary">{notice}</p>}
    <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-action px-4 text-sm font-semibold text-action-foreground disabled:opacity-50">
      {busy && <Loader2 className="h-4 w-4 animate-spin" />} {purpose === 'recovery' ? 'Verify code and continue' : 'Verify email and sign in'}
    </button>
    <div className="flex flex-wrap justify-between gap-3 text-sm">
      <button type="button" onClick={resend} disabled={busy || seconds > 0} className="font-medium text-accent disabled:text-tertiary">{seconds > 0 ? `Resend in ${seconds}s` : 'Resend code'}</button>
      <button type="button" onClick={onBack} disabled={busy} className="font-medium text-secondary">Use another email</button>
    </div>
  </form>;
}
