import type { ExploreSort, RawgListType } from '@/lib/api';

export const EXPLORE_PAGE_SIZE = 20;
export const EXPLORE_MAX_PAGE = 250;
export const EXPLORE_GENRES = {
  'role-playing-games-rpg': 'RPG', action: 'Action', adventure: 'Adventure', shooter: 'Shooter',
  strategy: 'Strategy', simulation: 'Simulation', puzzle: 'Puzzle', racing: 'Racing',
  sports: 'Sports', fighting: 'Fighting', platformer: 'Platformer', indie: 'Indie',
} as Record<string, string>;
export const EXPLORE_TYPES = new Set(['best-of-year', 'popular-in-year', 'all-time', 'recent', 'genre']);
export const EXPLORE_PLATFORMS = new Set(['PC', 'PlayStation 5', 'PlayStation 4', 'Xbox Series X|S', 'Xbox One', 'Nintendo Switch', 'Android', 'iOS', 'Linux', 'macOS']);

const alphabetical = [
  { label: 'Name A–Z', value: 'name-asc' },
  { label: 'Name Z–A', value: 'name-desc' },
] as const;
const verdict = { label: 'Verdict ranking', value: 'rating' } as const;
const reviews = { label: 'Popularity by reviews', value: 'popular' } as const;
const added = { label: 'Added to catalogue', value: 'added' } as const;
const newest = { label: 'Release newest', value: 'newest' } as const;
const oldest = { label: 'Release oldest', value: 'oldest' } as const;

export function exploreSortOptions(type: RawgListType): ReadonlyArray<{ label: string; value: ExploreSort }> {
  switch (type) {
    case 'best-of-year': return [{ label: 'Community interest', value: 'default' }, ...alphabetical, newest, oldest];
    case 'all-time': return [{ label: 'RAWG community ranking', value: 'default' }, verdict];
    case 'popular-in-year': return [{ label: 'RAWG community ranking', value: 'default' }, verdict, reviews, ...alphabetical, newest, oldest, added];
    case 'recent': return [{ label: 'Release newest', value: 'default' }, verdict, reviews, ...alphabetical, oldest, added];
    case 'genre': return [{ label: 'Popularity by reviews', value: 'default' }, verdict, ...alphabetical, newest, oldest, added];
  }
}

export function normalizeExploreSort(type: RawgListType, value: string): ExploreSort | null {
  if ((type === 'best-of-year' || type === 'genre') && value === 'popular' || type === 'recent' && value === 'newest') return 'default';
  return exploreSortOptions(type).find(option => option.value === value)?.value ?? null;
}

export function parseExploreFilters(get: (key: string) => string | null, currentYear = new Date().getUTCFullYear()) {
  const getInt = (key: string, fallback: number) => {
    const value = get(key);
    return value && Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
  };
  const requestedType = get('type') ?? '';
  const type = (EXPLORE_TYPES.has(requestedType) ? requestedType : 'best-of-year') as RawgListType;
  const requestedGenre = get('genre') ?? '';
  const requestedPlatform = get('platform') ?? '';
  return {
    type,
    page: Math.max(1, Math.min(EXPLORE_MAX_PAGE, getInt('page', 1))),
    year: Math.max(1970, Math.min(currentYear, getInt('year', currentYear - 1))),
    genre: Object.hasOwn(EXPLORE_GENRES, requestedGenre) ? requestedGenre : 'action',
    platform: EXPLORE_PLATFORMS.has(requestedPlatform) ? requestedPlatform : '',
    sort: normalizeExploreSort(type, get('sort') ?? 'default') ?? 'default',
  };
}

export function exploreFilterKey({ type, page, year, genre, sort, platform }: ReturnType<typeof parseExploreFilters>) {
  return [type, page, type === 'popular-in-year' ? year : '', type === 'genre' ? genre : '', sort, platform].join('|');
}
