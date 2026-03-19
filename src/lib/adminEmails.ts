export const ADMIN_EMAILS = [
  "metkaratharva1@gmail.com",
  "yogeshvadivel456@gmail.com",
] as const;

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase().trim() as (typeof ADMIN_EMAILS)[number]);
}
