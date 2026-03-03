import type { MetadataRoute } from "next";

const SITE_URL = process.env.SITE_URL || "https://www.verdict.games";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}`, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/search`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/lists`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/reviews`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
  ];

  // Dynamic game pages
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return staticPages;

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    const { data: games } = await supabase
      .from("games")
      .select("slug, updated_at")
      .order("score", { ascending: false })
      .limit(1000);

    const gamePages: MetadataRoute.Sitemap = ((games as { slug: string; updated_at: string }[] | null) ?? []).map((game) => ({
      url: `${SITE_URL}/game/${game.slug}`,
      lastModified: new Date(game.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    }));

    return [...staticPages, ...gamePages];
  } catch {
    return staticPages;
  }
}
