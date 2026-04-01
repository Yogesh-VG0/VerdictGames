import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  getEditorialReviews,
  getGameAchievements,
  getGameNews,
  getGameReviews,
  getSteamReviews,
  getSystemRequirements,
} from "@/lib/api";
import GameDetailClientPage from "@/components/GameDetailClientPage";
import {
  GAME_DETAIL_REVALIDATE_SECONDS,
  getGameDetailRawgIdFromHeaders,
  loadGameDetail,
  parseGameDetailRawgId,
} from "@/lib/services/game-detail";
import { getRelatedGamesForGame } from "@/lib/services/relatedGames";

export const dynamic = "force-dynamic";

if (!GAME_DETAIL_REVALIDATE_SECONDS) {
  throw new Error("Game detail page requires the shared game detail loader revalidate contract.");
}

interface GameDetailPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ rawgId?: string | string[] | undefined }>;
}

export default async function GameDetailPage({ params, searchParams }: GameDetailPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestHeaders = await headers();
  const rawgId = parseGameDetailRawgId(resolvedSearchParams) ?? getGameDetailRawgIdFromHeaders(requestHeaders);

  const detail = await loadGameDetail({ slug, rawgId });

  if (detail.status !== "ok") {
    notFound();
  }

  if (detail.shouldRedirect && rawgId == null) {
    redirect(`/game/${detail.canonicalSlug}`);
  }

  const canonicalSlug = detail.game.slug;
  const isPreview = detail.game.isPreview === true;
  const [reviewsData, editorialReviews, newsData, achievementsData, systemRequirements, steamReviewsData, related] = await Promise.all([
    isPreview ? Promise.resolve({ items: [], total: 0, page: 1, pageSize: 24, hasMore: false }) : getGameReviews(canonicalSlug, { sort: "helpful" }),
    isPreview ? Promise.resolve([]) : getEditorialReviews(canonicalSlug),
    isPreview ? Promise.resolve({ title: detail.game.title, news: [] }) : getGameNews(canonicalSlug, 5),
    isPreview ? Promise.resolve({ title: detail.game.title, total: 0, achievements: [] }) : getGameAchievements(canonicalSlug, 50),
    isPreview ? Promise.resolve({ requirements: null }) : detail.game.platforms.includes("PC") ? getSystemRequirements(canonicalSlug) : Promise.resolve({ requirements: null }),
    isPreview ? Promise.resolve({ reviews: [], total: 0, steamAppId: null }) : getSteamReviews(canonicalSlug, 21),
    getRelatedGamesForGame(detail.game),
  ]);

  return (
    <GameDetailClientPage
      slug={canonicalSlug}
      rawgId={detail.game.rawgId ?? null}
      initialGame={detail.game}
      initialReviewsData={reviewsData}
      initialRelated={related}
      initialNewsData={newsData}
      initialAchievementsData={achievementsData}
      initialSystemRequirements={systemRequirements}
      initialEditorialReviews={editorialReviews}
      initialSteamReviewsData={steamReviewsData}
    />
  );
}

