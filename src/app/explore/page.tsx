import ExploreClientPage from '@/components/ExploreClientPage';
import { loadExplore, EXPLORE_TYPES, EXPLORE_GENRES, EXPLORE_SORTS, EXPLORE_PLATFORMS } from '@/lib/services/explore';
import type { RawgListType, ExploreSort } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === 'string' ? params[key] as string : '';
  const type = (EXPLORE_TYPES.has(value('type')) ? value('type') : 'best-of-year') as RawgListType;
  const page = Math.max(1, Math.min(250, Math.floor(Number(value('page')) || 1)));
  const year = Math.max(1970, Math.min(new Date().getFullYear(), Math.floor(Number(value('year')) || new Date().getFullYear() - 1)));
  const genre = EXPLORE_GENRES[value('genre')] ? value('genre') : 'action';
  const sort = (!EXPLORE_SORTS.has(value('sort')) || type === 'all-time' && !['default','rating'].includes(value('sort')) || type === 'best-of-year' && ['rating','added'].includes(value('sort')) ? 'default' : value('sort')) as ExploreSort;
  const platform = EXPLORE_PLATFORMS.has(value('platform')) ? value('platform') : '';
  const initialData = await loadExplore(type, page, 20, year, genre, sort, platform).catch(() => undefined);
  return <ExploreClientPage initialData={initialData} initialKey={[type, page, year, genre, sort, platform].join('|')} />;
}
