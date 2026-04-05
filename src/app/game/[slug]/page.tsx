import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import GameDetailClientPage from "@/components/GameDetailClientPage";
import {
  GAME_DETAIL_REVALIDATE_SECONDS,
  loadGameDetail,
  parseGameDetailRawgId,
} from "@/lib/services/game-detail";
import { buildSocialMetadata, DEFAULT_OG_IMAGE, serializeJsonLd, SITE_URL } from "@/lib/seo";

export const revalidate = 60;

if (GAME_DETAIL_REVALIDATE_SECONDS !== revalidate) {
  throw new Error("Game detail page revalidate must stay aligned with the shared game detail loader contract.");
}

interface GameDetailPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ rawgId?: string | string[] | undefined }>;
}

export async function generateMetadata({ params, searchParams }: GameDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawgId = parseGameDetailRawgId(resolvedSearchParams);
  const detail = await loadGameDetail({ slug, rawgId });

  if (detail.status !== "ok") {
    return { title: "Game Not Found" };
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
    ...buildSocialMetadata({
      title: metaTitle,
      description,
      url: pageUrl,
      image: ogImage,
      imageAlt: ogAlt,
      type: "article",
    }),
  };
}

export default async function GameDetailPage({ params, searchParams }: GameDetailPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawgId = parseGameDetailRawgId(resolvedSearchParams);

  const detail = await loadGameDetail({ slug, rawgId });

  if (detail.status !== "ok") {
    notFound();
  }

  if (detail.shouldRedirect && rawgId == null) {
    redirect(`/game/${detail.canonicalSlug}`);
  }

  const canonicalSlug = detail.game.slug;
  const game = detail.game;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.title,
    description: game.verdictSummary || game.description || undefined,
    image: game.headerImage || game.coverImage || undefined,
    url: `${SITE_URL}/game/${detail.canonicalSlug}`,
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
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <GameDetailClientPage
        slug={canonicalSlug}
        rawgId={game.rawgId ?? null}
        initialGame={game}
      />
    </>
  );
}

