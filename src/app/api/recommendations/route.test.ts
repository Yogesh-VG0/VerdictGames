import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({ library: [] as { game_id: string; game: { genres: string[] } }[], error: null as unknown }));
vi.mock('@/lib/supabase/auth', () => ({ getCurrentUser: async () => ({ profileId: 'local-fixture' }),
  getAuthSupabase: async () => ({ from: (table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'not', 'neq', 'gte', 'lte', 'order', 'limit', 'overlaps']) query[method] = () => query;
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(table === 'user_games'
      ? { data: state.library, error: state.error }
      : { data: games, error: null }).then(resolve);
    return query;
  } }),
}));

const games = ['shown', 'owned', 'indie', 'action', 'cancelled'].map((id, index) => ({
  id, slug: id, title: `Fixture ${index}`, steam_app_id: 500 + index,
  release_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
  release_status: id === 'cancelled' ? 'cancelled' : 'released',
  score: 91, verdict_score: 91, verdict_label: 'MUST PLAY', review_count: 10000, steam_total_count: 10000,
  confidence: 0.85, critic_score: 91, critic_source_count: 2,
  cover_image: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co456.jpg',
  header_image: '', description: 'An actual description long enough to qualify this fixture.',
  platforms: ['PC'], tags: ['Singleplayer'], genres: id === 'action' ? ['Action'] : ['Indie'],
}));
import { GET } from './route';

describe('private homepage recommendations', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:1');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'fixture');
    state.library = [];
    state.error = null;
  });
  afterEach(() => vi.unstubAllEnvs());
  const request = () => GET(new NextRequest('http://127.0.0.1/api/recommendations?context=homepage&limit=20&exclude=shown'));
  it('labels an empty-library fallback generic and excludes earlier rails and cancellations', async () => {
    const response = await request();
    expect(response.headers.get('Cache-Control')).toContain('private, no-store');
    const { data } = await response.json();
    expect(data.personalized).toBe(false);
    expect(data.games.map((game: { slug: string }) => game.slug).sort()).toEqual(['action', 'indie', 'owned']);
  });

  it('prefers matching genres, keeps a diverse fallback and excludes the library', async () => {
    state.library = [{ game_id: 'owned', game: { genres: ['Indie'] } }];
    const { data } = await (await request()).json();
    expect(data.personalized).toBe(true);
    expect(data.games.map((game: { slug: string }) => game.slug)).toEqual(['indie', 'action']);
    state.library.push({ game_id: 'outside-catalogue', game: { genres: ['Action', 'RPG'] } });
    const diverse = await (await request()).json();
    expect(diverse.data.games).toHaveLength(2);
  });

  it('returns an empty private result when the authenticated library cannot be read', async () => {
    state.error = { code: '57014' };
    const { data } = await (await request()).json();
    expect(data).toEqual({ games: [], personalized: false });
  });
});
