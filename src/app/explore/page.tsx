import ExploreClientPage from '@/components/ExploreClientPage';
import { loadExplore } from '@/lib/services/explore';

export const dynamic = 'force-dynamic';

export default async function ExplorePage() {
  const initialData = await loadExplore('best-of-year').catch(() => undefined);
  return <ExploreClientPage initialData={initialData} />;
}
