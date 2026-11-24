import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/admin/games/[id]/delete/route';

const state = vi.hoisted(() => ({
  game: null as { id: string; slug: string; title: string } | null,
  children: new Set<string>(),
  calls: [] as string[],
  parentError: false,
  denied: false,
  audit: vi.fn(async () => {}),
}));

vi.mock('@/lib/admin', () => ({
  requireAdmin: async () => state.denied
    ? { user: null, error: new Response(null, { status: 403 }) }
    : { user: { email: 'admin@example.invalid' }, error: null },
}));

vi.mock('@/lib/auditLog', () => ({ writeAuditLog: state.audit }));

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: () => ({
    from(table: string) {
      let deleting = false;
      let id: string;
      async function execute() {
        state.calls.push(`${deleting ? 'delete' : 'select'}:${table}:${id}`);
        if (!deleting) return { data: state.game, error: null };
        if (table === 'source_mappings') return { data: null, error: { message: 'relation missing' } };
        if (table !== 'games') {
          state.children.delete(table);
          return { data: null, error: null };
        }
        if (state.parentError) return { data: null, error: { message: 'fixture rejected parent deletion' } };
        const deleted = state.game?.id === id ? state.game : null;
        if (deleted) {
          // The checked-in foreign keys cascade in the same DELETE statement.
          state.children.clear();
          state.game = null;
        }
        return { data: deleted, error: null };
      }
      const query = {
        select: (columns: string) => { expect(columns).toBe('id, slug, title'); return query; },
        delete: () => { deleting = true; return query; },
        eq: (field: string, value: string) => {
          expect(field).toBe(table === 'games' ? 'id' : 'game_id');
          id = value;
          return query;
        },
        maybeSingle: execute,
        then: (resolve: (result: unknown) => unknown) => execute().then(resolve),
      };
      return query;
    },
  }),
}));

const game = { id: 'fixture-game', slug: 'sample-game', title: 'Sample Game' };
const children = ['list_items', 'game_sources', 'user_games'];

function request() {
  return DELETE(new NextRequest('http://localhost/api/admin/games/fixture-game/delete', { method: 'DELETE' }), {
    params: Promise.resolve({ id: game.id }),
  });
}

describe('admin game deletion', () => {
  beforeEach(() => {
    state.game = { ...game };
    state.children = new Set(children);
    state.calls = [];
    state.parentError = state.denied = false;
    state.audit.mockClear();
  });

  it('leaves the game and all dependents intact when deletion fails', async () => {
    state.parentError = true;
    const response = await request();
    expect(response.status).toBe(500);
    expect(state.game).toEqual(game);
    expect([...state.children]).toEqual(children);
    expect(state.calls).toEqual(['delete:games:fixture-game']);
    expect(state.audit).not.toHaveBeenCalled();
  });

  it('uses one cascading delete and audits only the returned row', async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true, data: { deleted: true, slug: game.slug, title: game.title },
    });
    expect(state.game).toBeNull();
    expect(state.children.size).toBe(0);
    expect(state.calls).toEqual(['delete:games:fixture-game']);
    expect(state.audit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      entity_id: game.id, action: 'delete', edited_by: 'admin@example.invalid',
    }));
  });

  it('keeps a zero-row delete private and does not report or audit success', async () => {
    state.game = null;
    const response = await request();
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toContain('private, no-store');
    expect(await response.json()).toEqual({ success: false, error: 'Game not found' });
    expect(state.audit).not.toHaveBeenCalled();
  });

  it('denies non-admins before accessing the database', async () => {
    state.denied = true;
    expect((await request()).status).toBe(403);
    expect(state.calls).toEqual([]);
    expect(state.audit).not.toHaveBeenCalled();
  });
});
