import { compareUpcomingTiming } from './release-timing';
import { describe, expect, it } from 'vitest';
import type { RawgListType } from '@/lib/api';
import { catalogueGameHref, selectCatalogueArtwork } from './artwork';
import { EXPLORE_GENRES, EXPLORE_MAX_PAGE, EXPLORE_PLATFORMS, exploreFilterKey, exploreSortOptions, parseExploreFilters } from './explore-filters';

const cases: RawgListType[] = ['best-of-year', 'popular-in-year', 'all-time', 'recent', 'genre'];
const read = (params: Record<string, string>, year = 2026) => parseExploreFilters(key => params[key] ?? null, year);

describe('Explore public filters', () => {
  it.each(cases)('parses all exposed sorts and platforms for %s', type => {
    const options = exploreSortOptions(type);
    expect(new Set(options.map(option => option.label)).size).toBe(options.length);
    for (const { value } of options) {
      for (const platform of ['', ...EXPLORE_PLATFORMS]) {
        expect(read({ type, sort: value, platform })).toMatchObject({ type, sort: value, platform });
      }
    }
  });

  it('compares evidenced upcoming windows and leaves TBA last in either direction', () => {
    const day = { precision: 'day', value: '2027-04-20' } as const;
    const quarter = { precision: 'quarter', value: '2027-Q2' } as const;
    const year = { precision: 'year', value: '2027' } as const;
    const unknown = { precision: 'tba' } as const;
    expect(compareUpcomingTiming(quarter, day, false)).toBeLessThan(0);
    expect(compareUpcomingTiming(year, quarter, true)).toBeGreaterThan(0);
    expect(compareUpcomingTiming(unknown, day, true)).toBeGreaterThan(0);
    expect(compareUpcomingTiming(unknown, day, false)).toBeGreaterThan(0);
  });

  it('accepts every genre, shares the API page cap, and advances the default year', () => {
    for (const genre of Object.keys(EXPLORE_GENRES)) expect(read({ type: 'genre', genre }).genre).toBe(genre);
    expect(read({ page: '251' }).page).toBe(EXPLORE_MAX_PAGE);
    expect(read({ page: '-1' }).page).toBe(1);
    expect(read({ year: '1967' }).year).toBe(1970);
    expect(read({}, 2027).year).toBe(2026);
    expect(exploreFilterKey(read({ sort: 'popular', year: '1990', genre: 'racing' }))).toBe(exploreFilterKey(read({})));
  });
});

describe('Stored artwork and provider links', () => {
  const cover = 'https://images.igdb.com/igdb/image/upload/t_cover_big/co123.jpg';
  const header = 'https://media.rawg.io/media/games/abc/scene.jpg';

  it('keeps the identity-matched poster and separate landscape artwork', () => {
    expect(selectCatalogueArtwork({ cover_image: cover }, header)).toEqual({
      image: cover, imageKind: 'cover', landscapeImage: header, landscapeImageKind: 'artwork',
    });
    expect(selectCatalogueArtwork({ cover_image: cover }).landscapeImageKind).toBe('cover');
    expect(selectCatalogueArtwork(undefined).landscapeImage).toBeNull();
  });

  it('rejects a header with a different stored Steam app ID and links provider-only records by ID', () => {
    const unrelated = 'https://cdn.akamai.steamstatic.com/steam/apps/9/library_hero.jpg';
    expect(selectCatalogueArtwork({ cover_image: cover, header_image: unrelated, steam_app_id: 8 }, header).landscapeImage).toBe(header);
    expect(catalogueGameHref({ slug: 'game', rawgId: 123 })).toBe('/game/game?rawgId=123');
    expect(catalogueGameHref({ slug: 'game', rawgId: 123, catalogueId: 'db-id' })).toBe('/game/game');
  });
});
