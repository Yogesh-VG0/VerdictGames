import { afterEach, expect, it, vi } from 'vitest';
import { slugify } from '@/lib/utils/slugify';
import { buildDeveloperDirectory } from './developer-directory-snapshot.mjs';

const fakes = vi.hoisted(() => ({
  directory: vi.fn(), hub: vi.fn(),
}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: () => ({
    from: (table: string) => {
      if (table !== 'gx_cache') throw new Error('Unexpected directory table');
      const query = { select: () => query, eq: () => query, abortSignal: () => query, maybeSingle: fakes.directory };
      return query;
    },
  }),
}));
vi.mock('@/lib/supabase/public', () => ({
  getPublicSupabase: () => ({
    from: (table: string) => {
      if (table !== 'games') throw new Error('Unexpected hub table');
      const query = {
        select: (columns: string) => {
          if (columns === 'developer') throw new Error('Cold directory traversal is disabled in this mode');
          return query;
        },
        in: (_column: string, names: string[]) => { fakes.hub(names); return query; },
        order: () => query, limit: () => query,
        abortSignal: async () => ({ data: [safe, { ...safe, id: 'unsafe', description: 'Hentai game.' }], error: null }),
      };
      return query;
    },
  }),
}));
import { loadDeveloperHub } from './developers';

const safe = {
  id: 'game-id', slug: 'game', title: 'Fixture game', developer: 'Studio A', cover_image: 'https://images.igdb.com/cover.jpg',
  platforms: ['PC'], genres: ['Action'], tags: [], description: 'A public game description.', release_date: '2024-01-01',
  review_count: 100, score: 80,
};
const directory = (instant: number) => buildDeveloperDirectory([
  safe, { ...safe, developer: 'Studio-A' },
], instant, slugify);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it('uses one directory point read, preserves aliases and verifies live game eligibility', async () => {
  vi.stubEnv('DEVELOPER_DIRECTORY_SNAPSHOT_ENABLED', 'true');
  fakes.directory.mockResolvedValue({ data: { payload: directory(Date.now()) } });
  const result = await loadDeveloperHub('studio-a');
  expect(fakes.directory).toHaveBeenCalledTimes(1);
  expect(fakes.hub).toHaveBeenCalledExactlyOnceWith(['Studio A', 'Studio-A']);
  expect(result?.gameCount).toBe(1);
  expect(result?.games.map(game => game.id)).toEqual(['game-id']);
});

it('fails safely on an expired generation and does not scan the catalogue', async () => {
  vi.stubEnv('DEVELOPER_DIRECTORY_SNAPSHOT_ENABLED', 'true');
  fakes.directory.mockResolvedValue({ data: { payload: directory(Date.now() - 3600_001) } });
  await expect(loadDeveloperHub('studio-a')).rejects.toThrow('Developer directory snapshot unavailable');
  expect(fakes.hub).not.toHaveBeenCalled();
});

it('does not use inherited object properties as developer names', async () => {
  vi.stubEnv('DEVELOPER_DIRECTORY_SNAPSHOT_ENABLED', 'true');
  fakes.directory.mockResolvedValue({ data: { payload: directory(Date.now()) } });
  expect(await loadDeveloperHub('constructor')).toBeNull();
  expect(fakes.hub).not.toHaveBeenCalled();
});
