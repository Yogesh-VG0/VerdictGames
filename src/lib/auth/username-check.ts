import { getUsernameValidationError, normalizeUsername } from './username';

export type UsernameAvailability = { available: boolean; reason: string | null };

// Per-form, short-lived hints only. The database unique constraint is authoritative.
export function createUsernameChecker(fetcher: typeof fetch = fetch) {
  const cache = new Map<string, { value: UsernameAvailability; expires: number }>();
  const pending = new Map<string, Promise<UsernameAvailability>>();
  return async (input: string): Promise<UsernameAvailability> => {
    const username = normalizeUsername(input);
    const invalid = getUsernameValidationError(username);
    if (invalid) return { available: false, reason: invalid };
    const previous = cache.get(username);
    if (previous && previous.expires > Date.now()) return previous.value;
    const inFlight = pending.get(username);
    if (inFlight) return inFlight;
    const request = (async () => {
      const response = await fetcher(`/api/auth/check-username?username=${encodeURIComponent(username)}`, {
        cache: 'no-store', signal: AbortSignal.timeout(3500),
      });
      const json = await response.json();
      if (!response.ok || json.success !== true || typeof json.data?.available !== 'boolean') {
        throw new Error('Temporarily unable to verify username. Please retry.');
      }
      const value = { available: json.data.available, reason: json.data.reason ?? null };
      if (cache.size >= 50) cache.delete(cache.keys().next().value!);
      cache.set(username, { value, expires: Date.now() + 15_000 });
      return value;
    })();
    pending.set(username, request);
    try { return await request; } finally { pending.delete(username); }
  };
}
