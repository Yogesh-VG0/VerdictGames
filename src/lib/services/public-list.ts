import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { getPublicSupabase } from '@/lib/supabase/public';
import { mapGameRow, mapListRow } from '@/lib/db/mappers';
import { GAME_CARD_COLUMNS_WITH_DESC } from '@/lib/db/columns';
import { passesCuratedListSelection } from '@/lib/utils/curatedLists';
import { dedupePublicCanonicalRows } from '@/lib/utils/publicCanonical';
import { isPublicSafeGame } from '@/lib/utils/publicSafety';
import { hasUsableCardImage } from '@/lib/utils/mediaReadiness';
import { collectSitemapRows } from '@/lib/seo/sitemap';
import type { GameRow, ListRow } from '@/lib/supabase/types';

const PUBLIC_DATABASE_READ_TIMEOUT_MS = 10_000;

// Only public, anonymously readable content may enter this shared cache.
export const loadPublicList = cache(unstable_cache(async (slug: string) => {
  if (!/^[a-z0-9_-]{1,150}$/i.test(slug)) return null;
  const db = getPublicSupabase();
  const { data: list, error } = await db.from('lists').select('*').eq('slug', slug).eq('is_public', true)
    .abortSignal(AbortSignal.timeout(PUBLIC_DATABASE_READ_TIMEOUT_MS)).maybeSingle();
  if (error) throw error;
  if (!list) return null;
  const items = await collectSitemapRows(async (after, size) => {
    let query = db.from('list_items').select('id,game_id,position').eq('list_id', list.id).order('id').limit(size);
    if (after) query = query.gt('id', after);
    const { data, error } = await query.abortSignal(AbortSignal.timeout(PUBLIC_DATABASE_READ_TIMEOUT_MS));
    if (error) throw error;
    return data ?? [];
  });
  items.sort((a, b) => a.position - b.position);
  const rows: GameRow[] = [];
  for (let offset = 0; offset < items.length; offset += 250) {
    const { data, error } = await db.from('games').select(GAME_CARD_COLUMNS_WITH_DESC).in('id', items.slice(offset, offset + 250).map(item => item.game_id))
      .abortSignal(AbortSignal.timeout(PUBLIC_DATABASE_READ_TIMEOUT_MS));
    if (error) throw error;
    rows.push(...(data ?? []) as unknown as GameRow[]);
  }
  const byId = new Map(rows.filter(row => isPublicSafeGame(row) && hasUsableCardImage(row)).map(row => [row.id, row]));
  const ordered = items.map(item => byId.get(item.game_id)).filter((row): row is GameRow => !!row);
  const games = dedupePublicCanonicalRows(ordered.filter(row => passesCuratedListSelection(list as ListRow, row))).map(mapGameRow);
  return mapListRow(list as ListRow, games);
}, ['public-list-v1'], { revalidate: 300 }));
