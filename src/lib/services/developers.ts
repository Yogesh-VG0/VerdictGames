import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import type { DeveloperHub } from '@/lib/api';
import { getPublicSupabase } from '@/lib/supabase/public';
import { GAME_CARD_COLUMNS_WITH_DESC } from '@/lib/db/columns';
import { mapGameRow } from '@/lib/db/mappers';
import type { GameRow } from '@/lib/supabase/types';
import { collectSitemapRows } from '@/lib/seo/sitemap';
import { slugify } from '@/lib/utils/slugify';
import { isPublicSafeGame } from '@/lib/utils/publicSafety';

const loadDeveloperNames = unstable_cache(async () => {
  const db = getPublicSupabase();
  const names = new Set<string>();
  let after: string | undefined;
  for (;;) {
    let query = db.from('games').select('developer').not('developer', 'is', null)
      .neq('developer', '').order('developer', { ascending: true }).limit(1000);
    if (after) query = query.gt('developer', after);
    const { data, error } = await query;
    if (error) throw error;
    for (const row of data ?? []) if (row.developer) names.add(row.developer);
    if (!data?.length || data.length < 1000) return [...names];
    const last = data[data.length - 1].developer;
    if (!last || last === after) throw new Error('Developer directory cursor did not advance');
    after = last;
  }
}, ['developer-names-v1'], { revalidate: 3600 });

const cachedDeveloperHub = unstable_cache(async (slug: string): Promise<DeveloperHub | null> => {
  if (!/^[a-z0-9_-]{1,150}$/.test(slug)) return null;
  const names = (await loadDeveloperNames()).filter(name => slugify(name) === slug);
  if (!names.length) return null;
  const rows = await collectSitemapRows(async (after, size) => {
    let query = getPublicSupabase().from('games').select(GAME_CARD_COLUMNS_WITH_DESC)
      .in('developer', names).order('id', { ascending: true }).limit(size);
    if (after) query = query.gt('id', after);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as GameRow[];
  });
  const games = rows.filter(row => row.cover_image && isPublicSafeGame(row)).map(mapGameRow)
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
  if (!games.length) return null;
  return { name: names[0], slug, gameCount: games.length,
    averageScore: Math.round(games.reduce((sum, game) => sum + game.score, 0) / games.length), games };
}, ['developer-hub-v1'], { revalidate: 900 });

export const loadDeveloperHub = cache(cachedDeveloperHub);
