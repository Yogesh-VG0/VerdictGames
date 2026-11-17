import type { AuthUser } from '@/lib/types';

/** Bounded recovery for a session whose private profile request failed. */
export async function loadOwnProfile(authId: string, isCurrent: () => boolean, request: typeof fetch = fetch): Promise<AuthUser | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!isCurrent()) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      let response = await request('/api/auth/me', { cache: 'no-store', signal: controller.signal });
      if (!isCurrent()) return null;
      if (response.status === 401) {
        const bootstrap = await request('/api/auth/bootstrap', { method: 'POST', cache: 'no-store', signal: controller.signal });
        if (!isCurrent()) return null;
        if (bootstrap.status === 403 || bootstrap.status === 429) return null;
        if (bootstrap.ok) response = await request('/api/auth/me', { cache: 'no-store', signal: controller.signal });
      }
      if (!isCurrent()) return null;
      if (response.ok) {
        const result = await response.json() as { success: boolean; data?: AuthUser };
        return isCurrent() && result.success && result.data?.id === authId ? result.data : null;
      }
      // Do not work around access denials or the application rate limiter.
      if (response.status !== 401 && response.status < 500) return null;
    } catch {
      // A network/invalid-response failure gets the same single retry.
    } finally {
      clearTimeout(timer);
    }
    if (attempt === 0 && isCurrent()) await new Promise(resolve => setTimeout(resolve, 250));
  }
  return null;
}
