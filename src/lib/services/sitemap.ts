import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { SITE_URL } from "@/lib/seo";
import { collectSitemapRows } from "@/lib/seo/sitemap";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { slugify } from '@/lib/utils/slugify';
import { GAME_DETAIL_SLUG_REDIRECTS } from '@/lib/services/game-detail';

const SITEMAP_REVALIDATE_SECONDS = 21600;

const getCachedDynamicSitemapPages = unstable_cache(
  async (): Promise<MetadataRoute.Sitemap> => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Sitemap database configuration is missing');

    const { getPublicSupabase } = await import("@/lib/supabase/public");
    const supabase = getPublicSupabase();

    const [games, lists, profiles] = await Promise.all([
      collectSitemapRows(async (after, size) => {
        let query = supabase.from('games')
          .select('id, slug, title, developer, cover_image, score, tags, genres, description')
          .order('id', { ascending: true }).limit(size);
        if (after) query = query.gt('id', after);
        const { data, error } = await query.abortSignal(AbortSignal.timeout(10000));
        if (error) throw error;
        return data ?? [];
      }, 1000),
      collectSitemapRows(async (after, size) => {
        let query = supabase.from('lists').select('id, slug')
          .eq('is_public', true).order('id', { ascending: true }).limit(size);
        if (after) query = query.gt('id', after);
        const { data, error } = await query.abortSignal(AbortSignal.timeout(10000));
        if (error) throw error;
        return data ?? [];
      }),
      collectSitemapRows(async (after, size) => {
        let query = supabase.from('profiles').select('id, username')
          .order('id', { ascending: true }).limit(size);
        if (after) query = query.gt('id', after);
        const { data, error } = await query.abortSignal(AbortSignal.timeout(10000));
        if (error) throw error;
        return data ?? [];
      }),
    ]);

    const publicGames = games.filter(game =>
      /^[a-z0-9-]{1,100}$/i.test(game.slug) && game.title && isPublicSafeGame(game)
      && !Object.hasOwn(GAME_DETAIL_SLUG_REDIRECTS, game.slug)
    );
    const gamePages: MetadataRoute.Sitemap = publicGames.map((game) => ({
      url: `${SITE_URL}/game/${game.slug}`,
      changeFrequency: "weekly" as const,
      priority: game.score >= 80 ? 0.9 : game.score >= 50 ? 0.8 : 0.7,
    }));

    const listPages: MetadataRoute.Sitemap = lists.map((list) => ({
      url: `${SITE_URL}/lists/${list.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    const developers = new Set<string>();
    for (const game of publicGames) {
      if (!game.cover_image) continue;
      const slug = slugify(game.developer ?? '');
      if (!/^[a-z0-9_-]{1,150}$/.test(slug)) continue;
      developers.add(slug);
    }
    const developerPages: MetadataRoute.Sitemap = [...developers].map(slug => ({
      url: `${SITE_URL}/developers/${slug}`, changeFrequency: 'weekly', priority: 0.6,
    }));
    const profilePages: MetadataRoute.Sitemap = profiles.filter(profile => /^[a-zA-Z0-9_-]{1,50}$/.test(profile.username))
      .map(profile => ({ url: `${SITE_URL}/profile/${encodeURIComponent(profile.username)}`, changeFrequency: 'weekly', priority: 0.4 }));
    return [...gamePages, ...listPages, ...developerPages, ...profilePages];
  },
  ["sitemap-pages-v6"],
  { revalidate: SITEMAP_REVALIDATE_SECONDS }
);

export async function loadSitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}`, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/explore`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/search`, changeFrequency: "daily", priority: 0.8 },
    ...['trending', 'top-rated', 'newest', 'upcoming', 'recently-added'].map(sort => ({
      url: `${SITE_URL}/search?sort=${sort}`, changeFrequency: 'daily' as const, priority: 0.7,
    })),
    { url: `${SITE_URL}/calendar`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/lists`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/reviews`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/news`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/deals`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/free-to-play`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/compare`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/about`, lastModified: "2026-11-25", changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Dynamic game pages
  // Never return a partial catalog when a batch fails.
  const dynamicPages = await getCachedDynamicSitemapPages();
  return [...staticPages, ...dynamicPages];
}
