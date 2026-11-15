import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown } }));
vi.mock('@/lib/supabase/public', () => ({ getPublicSupabase: () => {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'ilike', 'limit', 'abortSignal']) query[method] = () => query;
  query.maybeSingle = async () => state.result;
  return { from: () => query };
} }));
import { GET } from './route';
const request = (name = 'player_test') => new NextRequest(`http://localhost/api/auth/check-username?username=${name}`);
describe('username availability', () => {
  beforeEach(() => { state.result = { data: null, error: null }; });
  it('never reports availability when the database read fails', async () => {
    state.result.error = { message: 'permission denied' };
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect((await response.json()).data?.available).not.toBe(true);
  });
  it('returns bounded, uncached availability results', async () => {
    const response = await GET(request());
    expect((await response.json()).data.available).toBe(true);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    state.result.data = { id: 'private-id' };
    const taken = await (await GET(request())).json();
    expect(taken.data.available).toBe(false);
    expect(JSON.stringify(taken)).not.toContain('private-id');
  });
  it('validates reserved names before querying', async () => {
    expect((await (await GET(request('ADMIN'))).json()).data.available).toBe(false);
  });
});
