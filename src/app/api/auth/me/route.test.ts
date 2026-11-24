import { describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  current: vi.fn(),
  MissingProfileError: class extends Error {},
}));
vi.mock('@/lib/supabase/auth', () => ({
  getCurrentUser: auth.current,
  MissingProfileError: auth.MissingProfileError,
}));

import { GET } from './route';

describe('current profile outcome', () => {
  it('distinguishes signed out, missing profile and temporary auth failure, with private caching', async () => {
    auth.current.mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new auth.MissingProfileError())
      .mockRejectedValueOnce(new Error('Auth gateway unavailable'))
      .mockResolvedValueOnce({ id: 'verified-fixture' });
    for (const status of [401, 404, 503, 200]) {
      const response = await GET();
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toContain('private, no-store');
    }
    expect(auth.current).toHaveBeenCalledWith({ strict: true });
  });
});
