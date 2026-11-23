import { unstable_cache } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPublicSupabase } from '@/lib/supabase/public';
import type { Database, GameRow, ListRow } from '@/lib/supabase/types';
import type { GameListSummary } from '@/lib/types';
import { editorialListTitle, passesCuratedListSelection } from '@/lib/utils/curatedLists';
import { dedupePublicCanonicalRows } from '@/lib/utils/publicCanonical';
import { isPublicSafeGame } from '@/lib/utils/publicSafety';
import { coalesceCatalogueRead } from '@/lib/db/cached-catalogue';
import { hasUsableCardImage } from '@/lib/utils/mediaReadiness';

export const LIST_PAGE_SIZE = 24;
export interface ListSummaries { items: GameListSummary[]; hasNext: boolean; page: number }
const gameColumns = 'id,slug,title,cover_image,header_image,description,genres,tags,platforms,score,verdict_score,review_count,confidence,steam_total_count,critic_source_count,critic_score,community_score,release_date,release_status,is_provisional,verdict_label,steam_app_id,franchise,developer,publisher,hltb_main,rawg_id';

export async function readListSummaries(client: SupabaseClient<Database>, page: number, ownerId?: string, privateScope = false, kind = 'all'): Promise<ListSummaries> {
  let query = client.from('lists').select('id,slug,title,description,preview_text,cover_image,curated_by,created_at,tags,owner_id,is_public,is_system_managed,last_seeded_at');
  if (!privateScope) query = query.eq('is_public', true);
  if (ownerId) query = query.eq('owner_id', ownerId);
  if (kind !== 'all') query = query.eq('is_system_managed', kind === 'editorial');
  const { data, error } = await query.order('is_system_managed', { ascending: false }).order('created_at', { ascending: false }).order('id')
    .range((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE).abortSignal(AbortSignal.timeout(5000));
  if (error) throw error;
  const lists = (data || []).slice(0, LIST_PAGE_SIZE);
  if (!lists.length) return { items: [], hasNext: false, page };
  const items: { list_id: string; game_id: string; position: number }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await client.from('list_items').select('list_id,game_id,position')
      .in('list_id', lists.map(list => list.id)).order('position').order('id')
      .range(offset, offset + 999).abortSignal(AbortSignal.timeout(5000));
    if (result.error) throw result.error;
    items.push(...(result.data || []));
    if (!result.data || result.data.length < 1000) break;
    if (offset >= 9000) throw new Error('List membership exceeds supported read budget');
  }
  const gameIds = [...new Set((items || []).map(item => item.game_id))];
  const games = new Map<string, GameRow>();
  for (let index = 0; index < gameIds.length; index += 200) {
    const results=await Promise.all([index,index+100].filter(start=>start<gameIds.length).map(start=>
      client.from('games').select(gameColumns).in('id',gameIds.slice(start,start+100)).abortSignal(AbortSignal.timeout(5000))));
    for(const result of results) {
      if (result.error) throw result.error;
      for (const row of result.data || []) if (isPublicSafeGame(row) && hasUsableCardImage(row)) games.set(row.id, row as unknown as GameRow);
    }
  }
  return { page, hasNext: (data?.length || 0) > LIST_PAGE_SIZE, items: lists.map(list => {
    const rows = (items || []).filter(item => item.list_id === list.id).map(item => games.get(item.game_id))
      .filter((row): row is GameRow => Boolean(row && passesCuratedListSelection(list as ListRow, row)));
    const visible = dedupePublicCanonicalRows(rows);
    return {
      id: list.id, slug: list.slug, title: editorialListTitle(list), description: list.preview_text || list.description,
      coverImage: list.is_system_managed ? visible[0]?.cover_image || '' : list.cover_image || '', gameCount: visible.length,
      games: visible.filter(row => row.cover_image).slice(0, 4).map(row => ({ id: row.id, slug: row.slug, title: row.title, coverImage: row.cover_image })),
      curatedBy: list.curated_by, createdAt: list.created_at, tags: list.tags || [], ownerId: list.owner_id || undefined,
      isPublic: list.is_public, isSystemManaged: list.is_system_managed,
    };
  }) };
}

// Share pending work only for the fixed, anonymous overview. Personalized reads
// use readListSummaries directly and never enter either shared cache.
const readPublicOverview = coalesceCatalogueRead(() => readListSummaries(getPublicSupabase(), 1));
const readCachedPublicListSummaries = unstable_cache((page: number, ownerId: string | null, kind: string) =>
  page === 1 && !ownerId && kind === 'all'
    ? readPublicOverview()
    : readListSummaries(getPublicSupabase(), page, ownerId ?? undefined, false, kind),
['public-list-summaries-v5'], { revalidate: 300, tags: ['public-lists'] });

// Normalize defaults before building the key: SSR(1) and API(1,undefined,'all')
// must not create independent entries and duplicate catalogue refreshes.
export function loadPublicListSummaries(page = 1, ownerId?: string, kind = 'all'): Promise<ListSummaries> {
  return readCachedPublicListSummaries(page, ownerId ?? null, kind);
}
