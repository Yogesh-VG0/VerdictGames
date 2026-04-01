import { headers } from "next/headers";
import type { Metadata } from "next";
import { getGameDetailRawgIdFromHeaders, loadGameDetail } from "@/lib/services/game-detail";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const requestHeaders = await headers();
  const rawgId = getGameDetailRawgIdFromHeaders(requestHeaders);
  const detail = await loadGameDetail({ slug, rawgId });

  if (detail.status !== "ok") {
    return { title: "Game Not Found | verdict.games" };
  }

  const game = detail.game;
  const isPreview = game.isPreview === true;
  const description = game.verdictSummary
    ? `${game.verdictSummary.slice(0, 155)}…`
    : `${game.title} — ${game.score}/100 verdict score. ${game.genres.slice(0, 3).join(", ")} game by ${game.developer}.`;
  const canonicalPath = `/game/${detail.canonicalSlug}`;
  const pageUrl = `${SITE_URL}${canonicalPath}`;
  const ogImage = game.coverImage || game.headerImage || DEFAULT_OG_IMAGE;
  const metaTitle = isPreview ? `${game.title} — Preview` : `${game.title} — ${game.score}/100 Verdict`;
  const ogAlt = isPreview ? `${game.title} — Preview` : `${game.title} — ${game.score}/100 Verdict`;
  const keywords = [
    game.title,
    ...game.genres.slice(0, 4),
    ...game.platforms.slice(0, 3),
    game.developer,
    "game review",
    "verdict",
  ].filter(Boolean);

  return {
    title: metaTitle,
    description,
    keywords,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: metaTitle,
      description,
      url: pageUrl,
      images: [{ url: ogImage, width: 1200, height: 630, alt: ogAlt }],
      type: "article",
      siteName: "verdict.games",
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description,
      images: [ogImage],
    },
  };
}

export default async function GameLayout({ params, children }: Props) {
  const { slug } = await params;
  const requestHeaders = await headers();
  const rawgId = getGameDetailRawgIdFromHeaders(requestHeaders);
  const detail = await loadGameDetail({ slug, rawgId });
  const game = detail.status === "ok" ? detail.game : null;
  const canonicalSlug = detail.status === "ok" ? detail.canonicalSlug : slug;

  const jsonLd = game
    ? {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        name: game.title,
        description: game.verdictSummary || game.description || undefined,
        image: game.headerImage || game.coverImage || undefined,
        url: `${SITE_URL}/game/${canonicalSlug}`,
        genre: game.genres.slice(0, 4),
        gamePlatform: game.platforms.slice(0, 6),
        author: game.developer ? { "@type": "Organization", name: game.developer } : undefined,
        publisher: game.publisher ? { "@type": "Organization", name: game.publisher } : undefined,
        datePublished: game.releaseDate || undefined,
        aggregateRating:
          game.score > 0 && game.reviewCount > 0
            ? {
                "@type": "AggregateRating",
                ratingValue: game.score,
                bestRating: 100,
                worstRating: 0,
                ratingCount: game.reviewCount,
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

