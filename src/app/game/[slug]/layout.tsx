import type { Metadata } from "next";
import type { GameRow } from "@/lib/supabase/types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

type GameMeta = Pick<
  GameRow,
  "title" | "verdict_summary" | "cover_image" | "genres" | "platforms" | "score" | "developer" | "release_date" | "review_count"
>;

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

async function fetchGameMeta(slug: string): Promise<GameMeta | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    const { data } = await supabase
      .from("games")
      .select("title, verdict_summary, cover_image, genres, platforms, score, developer, release_date, review_count")
      .eq("slug", slug)
      .maybeSingle() as { data: GameMeta | null };

    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchGameMeta(slug);

  if (!data) return { title: "Game Not Found | verdict.games" };

  const description = data.verdict_summary
    ? `${data.verdict_summary.slice(0, 155)}…`
    : `${data.title} — ${data.score}/100 verdict score. ${data.genres.slice(0, 3).join(", ")} game by ${data.developer}.`;

  const pageUrl = `${SITE_URL}/game/${slug}`;
  const ogImage = data.cover_image || DEFAULT_OG_IMAGE;
  const keywords = [
    data.title,
    ...data.genres.slice(0, 4),
    ...data.platforms.slice(0, 3),
    data.developer,
    "game review",
    "verdict",
  ].filter(Boolean);

  return {
    title: `${data.title} — ${data.score}/100 Verdict`,
    description,
    keywords,
    alternates: { canonical: pageUrl },
    openGraph: {
      title: `${data.title} — ${data.score}/100 Verdict`,
      description,
      url: pageUrl,
      images: [{ url: ogImage, width: 400, height: 560 }],
      type: "article",
      siteName: "verdict.games",
    },
    twitter: {
      card: "summary_large_image",
      title: `${data.title} — ${data.score}/100 Verdict`,
      description,
      images: [ogImage],
    },
  };
}

export default async function GameLayout({ params, children }: Props) {
  const { slug } = await params;
  const data = await fetchGameMeta(slug);

  // JSON-LD structured data for rich search results
  const jsonLd = data
    ? {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        name: data.title,
        description: data.verdict_summary ?? undefined,
        image: data.cover_image ?? undefined,
        url: `${SITE_URL}/game/${slug}`,
        genre: data.genres?.slice(0, 4),
        gamePlatform: data.platforms?.slice(0, 6),
        author: { "@type": "Organization", name: data.developer },
        datePublished: data.release_date ?? undefined,
        aggregateRating:
          data.score > 0 && (data.review_count ?? 0) > 0
            ? {
                "@type": "AggregateRating",
                ratingValue: data.score,
                bestRating: 100,
                worstRating: 0,
                ratingCount: data.review_count,
              }
            : undefined,
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
