import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { resolveStaticPageLastModified } from "@/lib/seo";
import { collectSitemapRows } from "@/lib/seo/sitemap";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";
const SITEMAP_REVALIDATE_SECONDS = 3600;

/** Fixed build date for static pages — avoids crawler churn from new Date() every run */
const BUILD_DATE = resolveStaticPageLastModified();

export const revalidate = 3600;

const getCachedDynamicSitemapPages = unstable_cache(
  async (): Promise<MetadataRoute.Sitemap> => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return [];

    const { getPublicSupabase } = await import("@/lib/supabase/public");
    const supabase = getPublicSupabase();

    const [games, lists] = await Promise.all([
      collectSitemapRows(async (offset, size) => {
        const { data, error } = await supabase.from('games')
          .select('id, slug, title, cover_image, updated_at, score, tags, genres')
          .order('id', { ascending: true }).range(offset, offset + size - 1);
        if (error) throw error;
        return data ?? [];
      }),
      collectSitemapRows(async (offset, size) => {
        const { data, error } = await supabase.from('lists').select('id, slug, updated_at')
          .eq('is_public', true).order('id', { ascending: true }).range(offset, offset + size - 1);
        if (error) throw error;
        return data ?? [];
      }),
    ]);

    const gamePages: MetadataRoute.Sitemap = games.filter(game =>
      /^[a-z0-9-]{1,100}$/i.test(game.slug) && game.title && game.cover_image && isPublicSafeGame(game)
    ).map((game) => ({
      url: `${SITE_URL}/game/${game.slug}`,
      lastModified: new Date(game.updated_at),
      changeFrequency: "weekly" as const,
      priority: game.score >= 80 ? 0.9 : game.score >= 50 ? 0.8 : 0.7,
    }));

    const listPages: MetadataRoute.Sitemap = lists.map((list) => ({
      url: `${SITE_URL}/lists/${list.slug}`,
      lastModified: new Date(list.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    return [...gamePages, ...listPages];
  },
  ["sitemap-pages-v2"],
  { revalidate: SITEMAP_REVALIDATE_SECONDS }
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}`, lastModified: BUILD_DATE, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/explore`, lastModified: BUILD_DATE, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/search`, lastModified: BUILD_DATE, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/calendar`, lastModified: BUILD_DATE, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/lists`, lastModified: BUILD_DATE, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/reviews`, lastModified: BUILD_DATE, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/deals`, lastModified: BUILD_DATE, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/free-to-play`, lastModified: BUILD_DATE, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/compare`, lastModified: BUILD_DATE, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/about`, lastModified: BUILD_DATE, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified: BUILD_DATE, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, lastModified: BUILD_DATE, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Dynamic game pages
  // Throw on failure so ISR retains the last complete successful sitemap.
  const dynamicPages = await getCachedDynamicSitemapPages();
  return [...staticPages, ...dynamicPages];
}
