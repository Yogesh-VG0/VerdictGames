import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import GameDetailClientPage from "@/components/GameDetailClientPage";
import {
  GAME_DETAIL_REVALIDATE_SECONDS,
  loadGameDetail,
} from "@/lib/services/game-detail";
import { buildSocialMetadata, DEFAULT_OG_IMAGE, getGameDatePublished, serializeJsonLd, SITE_URL } from "@/lib/seo";

export const revalidate = 3600;
export const maxDuration = 30;

// Generate on first visit, then serve cached HTML. Query strings do not change
// the canonical game; RAWG ID resolution remains available through the API.
export function generateStaticParams() { return []; }

if (GAME_DETAIL_REVALIDATE_SECONDS !== revalidate) {
  throw new Error("Game detail page revalidate must stay aligned with the shared game detail loader contract.");
}

interface GameDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: GameDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = await loadGameDetail({ slug });

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
  const metaTitle = isPreview ? `${game.title} — Preview` : game.score > 0 ? `${game.title} — ${game.score}/100 Verdict` : `${game.title} — Release Date & Details`;
  const ogAlt = metaTitle;
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
    robots: isPreview ? { index: false, follow: true } : undefined,
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

export default async function GameDetailPage({ params }: GameDetailPageProps) {
  const { slug } = await params;
  const detail = await loadGameDetail({ slug });

  if (detail.status !== "ok") {
    notFound();
  }

  if (detail.shouldRedirect) {
    redirect(`/game/${detail.canonicalSlug}`);
  }

  const canonicalSlug = detail.game.slug;
  const game = detail.game;
  const canonicalUrl = `${SITE_URL}/game/${detail.canonicalSlug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "@id": `${canonicalUrl}#game`,
    name: game.title,
    description: game.verdictSummary || game.description || undefined,
    image: game.headerImage || game.coverImage || undefined,
    url: canonicalUrl,
    genre: game.genres.slice(0, 4),
    gamePlatform: game.platforms.slice(0, 6),
    author: game.developer ? { "@type": "Organization", name: game.developer } : undefined,
    publisher: game.publisher ? { "@type": "Organization", name: game.publisher } : undefined,
    datePublished: getGameDatePublished(game),
  };

  // The public detail API keeps its existing shape. The SSR client receives
  // only what the page needs, without enrichment timestamps or feed badges.
  const initialGame = { ...game };
  delete initialGame.lastEnrichedAt;
  delete initialGame.trendingReason;
  delete initialGame.momentum;
  delete initialGame.peakPlayers24h;
  delete initialGame.isFeaturedManual;
  delete initialGame.isTrendingManual;
  delete initialGame.trending;
  delete initialGame.featured;
  delete initialGame.wikipediaExcerpt;
  delete initialGame.rawgMetacritic;
  delete initialGame.rawgRating;
  delete initialGame.communityScore;
  delete initialGame.criticScore;
  delete initialGame.verdictScore;
  delete initialGame.franchise;
  delete initialGame.rawgId;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <GameDetailClientPage
        key={canonicalSlug}
        slug={canonicalSlug}
        rawgId={game.rawgId ?? null}
        initialGame={initialGame}
      />
    </>
  );
}
