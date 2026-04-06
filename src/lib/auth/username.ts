export const USERNAME_RE = /^[a-z0-9_]+$/i;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 24;
export const USERNAME_COLLISION_STEM_LENGTH = 19;

export const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "mod",
  "moderator",
  "system",
  "verdict",
  "verdictgames",
  "support",
  "help",
  "staff",
  "official",
  "root",
  "null",
  "undefined",
  "api",
  "www",
  "blog",
  "news",
]);

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function sanitizeUsername(value: string) {
  return normalizeUsername(value)
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, USERNAME_MAX_LENGTH);
}

export function getUsernameValidationError(value: string) {
  const username = normalizeUsername(value);

  if (!username) return "Username is required";
  if (username.length < USERNAME_MIN_LENGTH) return `Must be at least ${USERNAME_MIN_LENGTH} characters`;
  if (username.length > USERNAME_MAX_LENGTH) return `Must be ${USERNAME_MAX_LENGTH} characters or fewer`;
  if (!USERNAME_RE.test(username)) return "Only letters, numbers, and underscores allowed";
  if (RESERVED_USERNAMES.has(username)) return "This username is reserved";

  return null;
}

export async function pickAvailableUsername(base: string, exists: (username: string) => Promise<boolean>) {
  const sanitizedBase = sanitizeUsername(base);
  const initialCandidate = sanitizedBase.length >= USERNAME_MIN_LENGTH && !RESERVED_USERNAMES.has(sanitizedBase)
    ? sanitizedBase
    : "user";

  if (!(await exists(initialCandidate))) {
    return initialCandidate;
  }

  const stem = initialCandidate.slice(0, USERNAME_COLLISION_STEM_LENGTH);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = Math.floor(1000 + Math.random() * 9000).toString();
    const candidate = `${stem}_${suffix}`;
    if (!RESERVED_USERNAMES.has(candidate) && !(await exists(candidate))) {
      return candidate;
    }
  }

  throw new Error("Could not allocate an available username");
}
