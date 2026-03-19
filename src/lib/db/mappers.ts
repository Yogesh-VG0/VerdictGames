/**
 * VERDICT.GAMES — DB ↔ Frontend Model Mappers
 *
 * Converts Supabase row types into the frontend Game/Review/User/GameList interfaces.
 * Keeps database column naming (snake_case) isolated from frontend (camelCase).
 */

import type { Game, Review, ReviewComment, User, GameList, UserGame, Platform, MonetizationType, VerdictLabel, LibraryStatus } from "../types";
import type { GameRow, ReviewRow, ProfileRow, ListRow, UserGameRow, ReviewCommentRow } from "../supabase/types";
import { scoreToVerdict } from "../utils/score";

function computeTrendingReason(row: GameRow): string | undefined {
  const r = row as GameRow & { is_trending_manual?: boolean; is_featured_manual?: boolean };
  const momentum = row.momentum ?? 0;
  const score = displayScore(row.score ?? 0, row.review_count ?? 0);
  const currentPlayers = row.current_players ?? 0;
  const reviewCount = row.review_count ?? 0;

  // Priority order: movement > money > quality > status

  // 1. Momentum signals (most important)
  if (momentum > 0.2) return "🔥 Trending Up";
  if (momentum < -0.2) return "📉 Falling";

  // 2. Deals (high conversion)
  if (row.price_deal_url && row.price_lowest != null) return "💰 On Sale";

  // 3. Quality + recency
  if (row.release_date) {
    const age = Date.now() - new Date(row.release_date).getTime();
    if (age < 0) return "🗓️ Coming Soon";
    if (age < 30 * 86400000 && score >= 70) return "🚀 New & Hot";
    if (age < 30 * 86400000) return "✨ Just Released";
  }

  // 4. Quality tiers
  if (score >= 90 && reviewCount >= 50) return "👑 Top Rated";
  if (score >= 80 && reviewCount < 50 && currentPlayers < 5000) return "💎 Hidden Gem";

  // 5. Popularity
  if (currentPlayers > 10000) return "🎮 Popular Now";

  // 6. Manual overrides
  if (r.is_trending_manual || r.is_featured_manual) return "⭐ Editor's Pick";

  // 7. Generic fallback
  if (row.trending) return "🔥 Trending";
  return undefined;
}

const MIN_REVIEWS_FOR_RAW_SCORE = 50;
const BAYESIAN_PRIOR_WEIGHT = 500;
const BAYESIAN_PRIOR_SCORE = 80;

function displayScore(score: number, reviewCount: number): number {
  if (reviewCount >= MIN_REVIEWS_FOR_RAW_SCORE) return score;
  return Math.round(
    (score * reviewCount + BAYESIAN_PRIOR_SCORE * BAYESIAN_PRIOR_WEIGHT) /
      (reviewCount + BAYESIAN_PRIOR_WEIGHT)
  );
}

/** Map a games row to the frontend Game interface. */
export function mapGameRow(row: GameRow): Game {
  const flagProvisional = (row as GameRow & { is_provisional?: boolean }).is_provisional ?? false;
  const releaseStatus = (row as GameRow & { release_status?: string | null }).release_status ?? undefined;

  /* Stubs may set verdict_label to COMING SOON without is_provisional (e.g. migration 008 not applied). */
  const rowVerdict = row.verdict_label as VerdictLabel | undefined;
  const isComingSoonLabel = rowVerdict === "COMING SOON";
  const effectiveProvisional = flagProvisional || isComingSoonLabel;

  // Provisional / coming-soon rows bypass Bayesian smoothing — show 0 and preserve COMING SOON
  const rawScore = row.score ?? 0;
  const reviewCount = row.review_count ?? 0;
  const score = effectiveProvisional ? 0 : displayScore(rawScore, reviewCount);

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
    score,
    verdictLabel: effectiveProvisional
      ? ("COMING SOON" as VerdictLabel)
      : (scoreToVerdict(score) as VerdictLabel),
    verdictSummary: effectiveProvisional
      ? "This game is awaiting data enrichment."
      : row.verdict_summary,
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
    playersUpdatedAt: row.players_updated_at ?? undefined,
    trailerUrl: row.trailer_url ?? undefined,
    trailerThumbnail: row.trailer_thumbnail ?? undefined,
    igdbRating: row.igdb_rating ?? undefined,
    igdbUrl: row.igdb_url ?? undefined,
    wikipediaUrl: row.wikipedia_url ?? undefined,
    wikipediaExcerpt: row.wikipedia_excerpt ?? undefined,
    metacriticUrl: row.metacritic_url ?? undefined,
    websiteUrl: row.website_url ?? undefined,
    redditUrl: row.reddit_url ?? undefined,
    steamRatingLabel: row.steam_rating_label ?? undefined,
    rawgMetacritic: row.rawg_metacritic ?? undefined,
    rawgRating: row.rawg_rating ?? undefined,
    scoreSource: row.score_source ?? undefined,
    lastEnrichedAt: row.last_enriched_at ?? undefined,
    enrichmentSources: row.enrichment_sources ?? undefined,

    // HLTB
    hltbMain: row.hltb_main ?? undefined,
    hltbExtras: row.hltb_extras ?? undefined,
    hltbCompletionist: row.hltb_completionist ?? undefined,
    franchise: row.franchise ?? undefined,

    // Trending signals
    isFeaturedManual: (row as GameRow & { is_featured_manual?: boolean }).is_featured_manual ?? undefined,
    isTrendingManual: (row as GameRow & { is_trending_manual?: boolean }).is_trending_manual ?? undefined,
    trendingReason: computeTrendingReason(row),

    // Momentum
    momentum: row.momentum ?? undefined,

    // Provisional/upcoming (COMING SOON label alone counts — see effectiveProvisional)
    isProvisional: effectiveProvisional,
    releaseStatus,
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

/** Map a review_comments row to the frontend ReviewComment interface. */
export function mapCommentRow(
  row: ReviewCommentRow & {
    profile?: { username: string; avatar_url: string } | null;
  }
): ReviewComment {
  return {
    id: row.id,
    reviewId: row.review_id,
    userId: row.profile_id,
    username: row.profile?.username ?? "",
    userAvatar: row.profile?.avatar_url ?? "",
    body: row.body,
    parentId: row.parent_id ?? undefined,
    createdAt: row.created_at,
  };
}

/** Map a profiles row to the frontend User interface. */
export function mapProfileRow(
  row: ProfileRow,
  stats: { gamesReviewed: number; listsCreated: number; followerCount?: number; followingCount?: number; libraryCount?: number }
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
    followerCount: stats.followerCount ?? 0,
    followingCount: stats.followingCount ?? 0,
    libraryCount: stats.libraryCount ?? 0,
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
    ownerId: row.owner_id ?? undefined,
    isPublic: row.is_public,
  };
}

/** Map a user_games row (with joined game) to the frontend UserGame interface. */
export function mapUserGameRow(
  row: UserGameRow & {
    game?: GameRow | null;
  }
): UserGame {
  return {
    id: row.id,
    userId: row.user_id,
    gameId: row.game_id,
    game: row.game ? mapGameRow(row.game as GameRow) : undefined,
    status: row.status as LibraryStatus,
    personalRating: row.personal_rating ?? undefined,
    hoursPlayed: row.hours_played,
    notes: row.notes,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
  };
}
