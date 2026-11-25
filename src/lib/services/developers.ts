import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import type { DeveloperHub } from '@/lib/api';
import { getPublicSupabase } from '@/lib/supabase/public';
import { mapGameRow } from '@/lib/db/mappers';
import type { GameRow } from '@/lib/supabase/types';
import { collectSitemapRows } from '@/lib/seo/sitemap';
import { slugify } from '@/lib/utils/slugify';
import { isPublicSafeGame } from '@/lib/utils/publicSafety';
import { coalesceCatalogueRead } from '@/lib/db/cached-catalogue';

export const DEVELOPER_PAGE_REVALIDATE_SECONDS = 3600;

// Description is read for public-content filtering and never serialized.
const developerCardColumns = 'id,slug,title,description,cover_image,platforms,genres,tags,release_date,release_status,is_provisional,score,verdict_label,verdict_score,confidence,review_count,critic_score,igdb_rating,rawg_metacritic,steam_total_count,user_score,score_source';

const PUBLIC_DATABASE_READ_TIMEOUT_MS = 10_000;

const loadDeveloperDirectory = unstable_cache(coalesceCatalogueRead(async () => {
  const db = getPublicSupabase();
  const names = new Set<string>();
  let after: string | undefined;
  for (;;) {
    let query = db.from('games').select('developer').not('developer', 'is', null)
      .neq('developer', '').order('developer', { ascending: true }).limit(1000);
    if (after) query = query.gt('developer', after);
    const { data, error } = await query.abortSignal(AbortSignal.timeout(PUBLIC_DATABASE_READ_TIMEOUT_MS));
    if (error) throw error;
    for (const row of data ?? []) if (row.developer) names.add(row.developer);
    if (!data?.length || data.length < 1000) break;
    const last = data[data.length - 1].developer;
    if (!last || last === after) throw new Error('Developer directory cursor did not advance');
    after = last;
  }

  const namesBySlug = Object.create(null) as Record<string, string[]>;
  for (const name of names) {
    const slug = slugify(name);
    if (!(slug in namesBySlug)) namesBySlug[slug] = [];
    namesBySlug[slug].push(name);
  }
  return namesBySlug;
}), ['developer-directory-v2'], { revalidate: DEVELOPER_PAGE_REVALIDATE_SECONDS });

const cachedDeveloperHub = unstable_cache(async (slug: string, names: string[]): Promise<DeveloperHub | null> => {
  const rows = await collectSitemapRows(async (after, size) => {
    let query = getPublicSupabase().from('games').select(developerCardColumns)
      .in('developer', names).order('id', { ascending: true }).limit(size);
    if (after) query = query.gt('id', after);
    const { data, error } = await query.abortSignal(AbortSignal.timeout(PUBLIC_DATABASE_READ_TIMEOUT_MS));
    if (error) throw error;
    return (data ?? []) as unknown as GameRow[];
  });
  const games = rows.filter(row => row.cover_image && isPublicSafeGame(row)).map(row => {
    const game = mapGameRow(row);
    const { id, slug, title, coverImage, platforms, genres, releaseDate, releaseDateTba,
      score, verdictLabel, verdictSummary, confidence, scoreSource, isProvisional, releaseStatus } = game;
    return { id, slug, title, coverImage, platforms, genres, releaseDate, releaseDateTba,
      score, verdictLabel, verdictSummary, confidence, scoreSource, isProvisional, releaseStatus };
  }).sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
  if (!games.length) return null;
  return { name: names[0], slug, gameCount: games.length,
    averageScore: Math.round(games.reduce((sum, game) => sum + game.score, 0) / games.length), games };
}, ['developer-hub-v3'], { revalidate: DEVELOPER_PAGE_REVALIDATE_SECONDS });

export const loadDeveloperHub = cache(async (slug: string): Promise<DeveloperHub | null> => {
  if (!/^[a-z0-9_-]{1,150}$/.test(slug)) return null;
  // Index every spelling once per shared directory refresh, retaining their
  // original order for the canonical name and membership query.
  const directory = await loadDeveloperDirectory();
  return Object.hasOwn(directory, slug) ? cachedDeveloperHub(slug, directory[slug]) : null;
});
