import { describe, expect, it } from 'vitest';
import { isCompleteSitemapSnapshot, sitemapRowPaths } from './sitemap-snapshot.mjs';

describe('published sitemap eligibility', () => {
  const game = {
    slug: 'valid-game', title: 'Mature adventure', developer: 'Studio & Friends', has_art: true,
    tags: ['Mature', 'Nudity'], genres: ['Adventure'],
  };

  it('keeps safe detail pages and derives developer links using the existing slug rules', () => {
    expect(sitemapRowPaths('games', game)).toEqual(['/game/valid-game', '/developers/studio-and-friends']);
    expect(sitemapRowPaths('games', { ...game, has_art: false })).toEqual(['/game/valid-game']);
  });

  it('excludes known aliases, unsafe descriptions and unsafe tags', () => {
    expect(sitemapRowPaths('games', { ...game, slug: 'black-myth-wu-kong' })).toEqual([]);
    expect(sitemapRowPaths('games', { ...game, unsafe_description: true })).toEqual([]);
    expect(sitemapRowPaths('games', { ...game, tags: ['Adult Content'] })).toEqual([]);
  });

  it('refuses incomplete, empty, duplicate, off-site or private entries', () => {
    const snapshot = { version: 1, complete: true, count: 2, paths: ['/game/valid-game', '/lists/curated'] };
    expect(isCompleteSitemapSnapshot(snapshot)).toBe(true);
    for (const sample of [
      { ...snapshot, complete: false }, { ...snapshot, count: 0, paths: [] },
      { ...snapshot, paths: ['/game/valid-game', '/game/valid-game'] },
      { ...snapshot, paths: ['/game/valid-game', '/library/secret'] },
      { ...snapshot, paths: ['/game/valid-game', '//elsewhere.test'] },
    ]) expect(isCompleteSitemapSnapshot(sample)).toBe(false);
  });
});
