import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as readScheduler } from './scheduler-runs/route';
import { GET as readStats } from './stats/route';

const fixture = vi.hoisted(() => ({
  role: null as string | null,
  readError: '',
  rows: [] as Record<string, unknown>[],
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/auth', () => ({
  getCurrentUser: async () => fixture.role ? { role: fixture.role } : null,
}));
vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: () => ({ from: fixture.from }),
}));

describe('admin dashboard reads', () => {
  beforeEach(() => {
    fixture.role = 'admin';
    fixture.readError = '';
    fixture.rows = [];
    fixture.from.mockReset().mockImplementation((table: string) => {
      const query = {
        select: () => query,
        gte: () => query,
        order: () => query,
        limit: () => query,
        then: (resolve: (result: unknown) => void) => resolve({
          count: { games: 8356, reviews: 2, profiles: 16 }[table],
          data: fixture.rows,
          error: table === fixture.readError ? { message: 'internal read failure' } : null,
        }),
      };
      return query;
    });
  });

  it.each([[null, 401], ['user', 403]] as const)(
    'denies role %s before either route queries the database',
    async (role, status) => {
      fixture.role = role;
      const request = new NextRequest('http://localhost/api/admin/scheduler-runs');
      for (const response of [await readStats(), await readScheduler(request)]) {
        expect(response.status).toBe(status);
        expect(response.headers.get('cache-control')).toContain('private, no-store');
        expect(response.headers.get('vary')).toBe('Cookie');
      }
      expect(fixture.from).not.toHaveBeenCalled();
    },
  );

  it('returns exact counts and keeps failures private', async () => {
    const response = await readStats();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('private, no-store');
    expect((await response.json()).data).toEqual({ totalGames: 8356, totalReviews: 2, totalUsers: 16 });

    fixture.readError = 'profiles';
    const failed = await readStats();
    expect(failed.status).toBe(503);
    expect(failed.headers.get('cache-control')).toContain('private, no-store');
    expect(await failed.json()).toEqual({ success: false, error: 'Dashboard counts are unavailable.' });
  });

  it('projects stale and deferred runs through a read-only interface', async () => {
    const now = Date.now();
    fixture.rows = [
      { job_name: 're-enrich', status: 'running', started_at: new Date(now - 60_000).toISOString() },
      { job_name: 're-enrich', status: 'running', started_at: new Date(now - 10_800_000).toISOString(), finished_at: null },
      { job_name: 're-enrich', status: 'error', started_at: new Date(now - 14_400_000).toISOString(), metadata: { outcome: 'deferred' } },
    ];
    const response = await readScheduler(new NextRequest('http://localhost/api/admin/scheduler-runs'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('private, no-store');
    const { data } = await response.json();
    expect(data.runs.map((row: { status: string }) => row.status)).toEqual(['running', 'stale', 'deferred']);
    expect(data.summary['re-enrich']).toMatchObject({ running: 1, stale: 1, deferred: 1, error: 0 });
    expect(fixture.rows[1]).toMatchObject({ status: 'running', finished_at: null });
    expect(fixture.from.mock.calls).toEqual([['scheduler_runs'], ['scheduler_runs']]);
  });
});
