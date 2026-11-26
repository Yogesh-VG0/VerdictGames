import type { Game, GameCardData } from "@/lib/types";

export type SpotlightGame = Pick<Game,
  "id" | "slug" | "title" | "headerImage" | "heroArtworkFallback" | "heroArtworkMobileFocalPoint" |
  "description" | "verdictSummary" | "score" | "confidence" | "verdictLabel" | "releaseStatus" |
  "releaseDate" | "isProvisional" | "platforms" | "genres" | "hltbMain" | "trailerUrl" |
  "currentPlayers" | "playersUpdatedAt" | "spotlightReason" | "isFeaturedManual" | "featured" |
  "priceCurrent" | "priceLowest" | "isFree">;

export function toHomepageCard(game: Game): GameCardData {
  const { id, slug, title, coverImage, platforms, genres, releaseDate, releaseDateTba, score,
    verdictLabel, verdictSummary, confidence, scoreSource, isPreview, rawgId, isProvisional,
    releaseStatus, releaseTiming, trendingReason, playersUpdatedAt } = game;
  return { id, slug, title, coverImage, platforms, genres, releaseDate, releaseDateTba, score,
    verdictLabel, verdictSummary, confidence, scoreSource, isPreview, rawgId, isProvisional,
    releaseStatus, releaseTiming, trendingReason,
    ...(trendingReason === "Past Momentum" ? { playersUpdatedAt } : {}),
  };
}

export function toSpotlightGame(game: Game): SpotlightGame {
  const { id, slug, title, headerImage, heroArtworkFallback, heroArtworkMobileFocalPoint, description,
    verdictSummary, score, confidence, verdictLabel, releaseStatus, releaseDate, isProvisional,
    platforms, genres, hltbMain, trailerUrl, currentPlayers, playersUpdatedAt, spotlightReason,
    isFeaturedManual, featured, priceCurrent, priceLowest, isFree } = game;
  return { id, slug, title, headerImage, heroArtworkFallback, heroArtworkMobileFocalPoint, description,
    verdictSummary, score, confidence, verdictLabel, releaseStatus, releaseDate, isProvisional,
    platforms, genres, hltbMain, trailerUrl, currentPlayers, playersUpdatedAt, spotlightReason,
    isFeaturedManual, featured, priceCurrent, priceLowest, isFree };
}
