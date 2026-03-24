import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return { title: "List | verdict.games" };

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    const { data } = await supabase
      .from("lists")
      .select("title, description, cover_image")
      .eq("slug", slug)
      .maybeSingle();

    if (!data) return { title: "List Not Found | verdict.games" };

    const description = data.description
      ? `${(data.description as string).slice(0, 155)}…`
      : `${data.title} — a curated game list on verdict.games.`;

    const pageUrl = `${SITE_URL}/lists/${slug}`;
    const ogImage = (data.cover_image as string) || DEFAULT_OG_IMAGE;

    return {
      title: data.title as string,
      description,
      keywords: [data.title as string, "curated list", "game list", "verdict games"],
      alternates: { canonical: pageUrl },
      openGraph: {
        title: `${data.title} | verdict.games`,
        description,
        url: pageUrl,
        images: [{ url: ogImage }],
        type: "article",
        siteName: "verdict.games",
      },
      twitter: {
        card: "summary_large_image",
        title: `${data.title} | verdict.games`,
        description,
        images: [ogImage],
      },
    };
  } catch {
    return { title: "List | verdict.games" };
  }
}

export default function ListDetailLayout({ children }: Props) {
  return children;
}
