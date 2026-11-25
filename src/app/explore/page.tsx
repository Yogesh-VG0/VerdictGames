import ExploreClientPage from '@/components/ExploreClientPage';
import { loadExplore } from '@/lib/services/explore';
import { EXPLORE_PAGE_SIZE, exploreFilterKey, parseExploreFilters } from '@/lib/utils/explore-filters';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = parseExploreFilters(key => typeof params[key] === 'string' ? params[key] : null);
  const { type, page, year, genre, sort, platform } = filters;
  const initialData = await loadExplore(type, page, EXPLORE_PAGE_SIZE, year, genre, sort, platform).catch(() => undefined);
  return <ExploreClientPage initialData={initialData} initialKey={exploreFilterKey(filters)} />;
}
