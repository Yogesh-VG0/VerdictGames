export const ADMIN_EMAILS = [
  "yogeshvadivel456@gmail.com",
  "atharva@verdict.games",
] as const;

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase().trim() as (typeof ADMIN_EMAILS)[number]);
}
