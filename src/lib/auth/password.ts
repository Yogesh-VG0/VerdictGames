// New credentials only: never apply a new policy to existing-password login.
export const PASSWORD_MIN_LENGTH = 15;
// Supabase Auth uses bcrypt. Reject oversized UTF-8 input rather than truncate.
export const PASSWORD_MAX_BYTES = 72;
const COMMON_PASSWORDS = new Set([
  'passwordpassword', 'password123456789', '123456789012345',
  'qwertyuiopasdfgh', 'letmeinletmeinletmein', 'verdictgames123',
]);

export function getPasswordValidationError(password: string): string | null {
  if ([...password].length < PASSWORD_MIN_LENGTH) return 'Use at least 15 characters. A unique passphrase works well.';
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return 'Use at most 72 UTF-8 bytes (72 plain English characters; fewer for emoji and some languages).';
  if (password.includes('\0')) return 'Passwords cannot contain a null character.';
  if (COMMON_PASSWORDS.has(password.toLowerCase()) || /^(.)\1+$/u.test(password)) return 'This password is too common. Choose a unique password or passphrase.';
  return null;
}
