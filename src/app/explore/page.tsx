import ExploreClientPage from '@/components/ExploreClientPage';
import { loadExplore } from '@/lib/services/explore';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export default async function ExplorePage() {
  const initialData = await loadExplore('best-of-year').catch(() => undefined);
  return <ExploreClientPage initialData={initialData} />;
}
