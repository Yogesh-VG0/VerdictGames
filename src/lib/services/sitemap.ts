import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase/server";
import { coalesceCatalogueRead } from "@/lib/db/cached-catalogue";
import { isCompleteSitemapSnapshot, SITEMAP_MAX_AGE_MS, SITEMAP_SNAPSHOT_KEY } from "@/lib/seo/sitemap-snapshot.mjs";

const readPublishedSnapshot = unstable_cache(coalesceCatalogueRead(async () => {
  const { data, error } = await getServerSupabase().from('gx_cache').select('payload,fetched_at')
    .eq('feed_key', SITEMAP_SNAPSHOT_KEY).abortSignal(AbortSignal.timeout(2_000)).maybeSingle();
  if (error) throw error;
  const fetchedAt = data ? Date.parse(data.fetched_at) : NaN;
  const paths = (data?.payload as { paths?: string[] } | null)?.paths;
  if (!Number.isFinite(fetchedAt) || !paths || !isCompleteSitemapSnapshot(data?.payload)) {
    throw new Error('Complete sitemap snapshot unavailable');
  }
  return { paths, fetchedAt };
}), ['sitemap-published-v1'], { revalidate: 21600 });

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

  // The worker publishes a complete generation outside the request path.
  // A missing generation is a retryable failure, never a static-only sitemap.
  const { paths, fetchedAt } = await readPublishedSnapshot();
  const age = Date.now() - fetchedAt;
  if (age < 0 || age > SITEMAP_MAX_AGE_MS) throw new Error('Complete sitemap snapshot expired');
  return [...staticPages, ...paths.map(path => ({ url: SITE_URL + path }))];
}
