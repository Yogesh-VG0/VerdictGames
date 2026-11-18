export type EmailCodePurpose = 'email' | 'recovery';

// Hosted and local Supabase may have different configured OTP lengths.
// Keep leading zeros and let Auth enforce the exact length, expiry and reuse.
export function normalizeEmailCode(value: string) {
  return value.replace(/\s/g, '');
}

export function isEmailCode(value: string) {
  return /^\d{6,10}$/.test(normalizeEmailCode(value));
}

export function readConfirmationToken(fragment: string): string | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const tokens = params.getAll('token_hash');
  return tokens.length === 1 && /^[A-Za-z0-9_-]{32,128}$/.test(tokens[0]) ? tokens[0] : null;
}
