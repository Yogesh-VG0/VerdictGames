import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  getEditorialReviews,
  getGameAchievements,
  getGameNews,
  getGameReviews,
  getSteamReviews,
  getSystemRequirements,
  searchGames,
} from "@/lib/api";
import GameDetailClientPage from "@/components/GameDetailClientPage";
import {
  GAME_DETAIL_REVALIDATE_SECONDS,
  getGameDetailRawgIdFromHeaders,
  loadGameDetail,
  parseGameDetailRawgId,
} from "@/lib/services/game-detail";
import type { Game } from "@/lib/types";

export const dynamic = "force-dynamic";

if (!GAME_DETAIL_REVALIDATE_SECONDS) {
  throw new Error("Game detail page requires the shared game detail loader revalidate contract.");
}

interface GameDetailPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ rawgId?: string | string[] | undefined }>;
}

async function getInitialRelatedGames(game: Game): Promise<Game[]> {
  const primaryGenre = game.genres[0];

  if (!primaryGenre) {
    return [];
  }

  try {
    const results = await searchGames({ genre: primaryGenre, sort: "top-rated", page: 1 });
    return results.items.filter((candidate) => candidate.slug !== game.slug).slice(0, 4);
  } catch {
    return [];
  }
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
  const [reviewsData, editorialReviews, newsData, achievementsData, systemRequirements, steamReviewsData, related] = await Promise.all([
    getGameReviews(canonicalSlug, { sort: "helpful" }),
    getEditorialReviews(canonicalSlug),
    getGameNews(canonicalSlug, 5),
    getGameAchievements(canonicalSlug, 50),
    detail.game.platforms.includes("PC") ? getSystemRequirements(canonicalSlug) : Promise.resolve({ requirements: null }),
    getSteamReviews(canonicalSlug, 21),
    getInitialRelatedGames(detail.game),
  ]);

  return (
    <GameDetailClientPage
      slug={canonicalSlug}
      rawgId={null}
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

