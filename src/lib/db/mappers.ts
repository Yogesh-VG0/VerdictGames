/**
 * VERDICT.GAMES — DB ↔ Frontend Model Mappers
 *
 * Converts Supabase row types into the frontend Game/Review/User/GameList interfaces.
 * Keeps database column naming (snake_case) isolated from frontend (camelCase).
 */

import type { Game, Review, User, GameList, Platform, MonetizationType, VerdictLabel } from "../types";
import type { GameRow, ReviewRow, ProfileRow, ListRow } from "../supabase/types";

/** Map a games row to the frontend Game interface. */
export function mapGameRow(row: GameRow): Game {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    coverImage: row.cover_image,
    headerImage: row.header_image,
    screenshots: row.screenshots,
    platforms: row.platforms as Platform[],
    genres: row.genres,
    tags: row.tags,
    developer: row.developer,
    publisher: row.publisher,
    releaseDate: row.release_date ?? "",
    description: row.description,
    score: row.score,
    verdictLabel: row.verdict_label as VerdictLabel,
    verdictSummary: row.verdict_summary,
    pros: row.pros,
    cons: row.cons,
    monetization: row.monetization as MonetizationType,
    performanceNotes: row.performance_notes,
    monetizationNotes: row.monetization_notes,
    steamUrl: row.steam_url ?? undefined,
    playStoreUrl: row.play_store_url ?? undefined,
    reviewCount: row.review_count,
    userScore: row.user_score ?? undefined,
    featured: row.featured,
    trending: row.trending,

    // Multi-source fields
    priceCurrent: row.price_current ?? undefined,
    priceCurrency: row.price_currency ?? undefined,
    priceLowest: row.price_lowest ?? undefined,
    priceDealUrl: row.price_deal_url ?? undefined,
    isFree: row.is_free ?? undefined,
    currentPlayers: row.current_players ?? undefined,
    peakPlayers24h: row.peak_players_24h ?? undefined,
    trailerUrl: row.trailer_url ?? undefined,
    trailerThumbnail: row.trailer_thumbnail ?? undefined,
    igdbRating: row.igdb_rating ?? undefined,
    igdbUrl: row.igdb_url ?? undefined,
    wikipediaUrl: row.wikipedia_url ?? undefined,
    wikipediaExcerpt: row.wikipedia_excerpt ?? undefined,
    metacriticUrl: row.metacritic_url ?? undefined,
    websiteUrl: row.website_url ?? undefined,
    redditUrl: row.reddit_url ?? undefined,
    lastEnrichedAt: row.last_enriched_at ?? undefined,
    enrichmentSources: row.enrichment_sources ?? undefined,
  };
}

/** Map a reviews row (with joined game & profile data) to the frontend Review interface. */
export function mapReviewRow(
  row: ReviewRow & {
    game?: { slug: string; title: string; cover_image: string } | null;
    profile?: { username: string; avatar_url: string } | null;
  }
): Review {
  return {
    id: row.id,
    gameId: row.game_id,
    gameSlug: row.game?.slug ?? "",
    gameTitle: row.game?.title ?? "",
    gameCover: row.game?.cover_image ?? "",
    userId: row.profile_id,
    username: row.profile?.username ?? "",
    userAvatar: row.profile?.avatar_url ?? "",
    rating: row.rating,
    title: row.title,
    body: row.body,
    pros: row.pros.length > 0 ? row.pros : undefined,
    cons: row.cons.length > 0 ? row.cons : undefined,
    helpful: row.helpful,
    createdAt: row.created_at,
    platform: row.platform as Platform,
  };
}

/** Map a profiles row to the frontend User interface. */
export function mapProfileRow(
  row: ProfileRow,
  stats: { gamesReviewed: number; listsCreated: number }
): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatar: row.avatar_url,
    bio: row.bio,
    gamesReviewed: stats.gamesReviewed,
    listsCreated: stats.listsCreated,
    joinedAt: row.joined_at,
    favoriteGenres: row.favorite_genres,
    recentActivity: [], // populated separately
  };
}

/** Map a lists row (with games) to the frontend GameList interface. */
export function mapListRow(
  row: ListRow,
  games: Game[]
): GameList {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverImage: row.cover_image,
    gameCount: games.length,
    games,
    curatedBy: row.curated_by,
    createdAt: row.created_at,
    tags: row.tags,
  };
}
