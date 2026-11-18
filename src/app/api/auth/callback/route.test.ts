import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ exchange: vi.fn(), createClient: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createClient }));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));
import { GET } from './route';

describe('Auth callback compatibility', () => {
  beforeEach(() => {
    mocks.createClient.mockReset().mockReturnValue({ auth: { exchangeCodeForSession: mocks.exchange } });
    mocks.exchange.mockReset().mockResolvedValue({ error: null });
  });
  it('lands a new confirmation link without consuming it or trusting its next target', async () => {
    const response = await GET(new NextRequest('http://localhost/api/auth/callback?flow=confirmation&next=https://evil.test'));
    expect(response.headers.get('location')).toBe('http://localhost/auth/confirm');
    expect(response.headers.get('cache-control')).toContain('private, no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it('keeps existing OAuth and pending legacy confirmation codes working', async () => {
    const response = await GET(new NextRequest('http://localhost/api/auth/callback?code=local-test-only&next=/library'));
    expect(mocks.exchange).toHaveBeenCalledWith('local-test-only');
    expect(response.headers.get('location')).toBe('http://localhost/library');
  });
  it('keeps legacy recovery failures recoverable without an open redirect', async () => {
    mocks.exchange.mockResolvedValue({ error: { message: 'invalid code' } });
    const response = await GET(new NextRequest('http://localhost/api/auth/callback?code=local-test-only&flow=recovery&next=//evil.test'));
    const destination = new URL(response.headers.get('location')!);
    expect(destination.origin).toBe('http://localhost');
    expect(destination.pathname).toBe('/reset-password');
    expect(destination.searchParams.get('reset_error')).toBe('link_invalid');
  });
});
