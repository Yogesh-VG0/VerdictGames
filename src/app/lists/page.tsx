import ListsClientPage from '@/components/ListsClientPage';
import { loadPublicListSummaries } from '@/lib/services/lists';

export const dynamic = 'force-dynamic';
export default async function ListsPage() {
  const initialData = await loadPublicListSummaries(1).catch(() => undefined);
  return <ListsClientPage initialData={initialData} />;
}
