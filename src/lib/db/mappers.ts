import { getFreshPlayerSignals } from '@/lib/utils/trending';
/**
 * VERDICT.GAMES — DB ↔ Frontend Model Mappers
 *
 * Converts Supabase row types into the frontend Game/Review/User/GameList interfaces.
 * Keeps database column naming (snake_case) isolated from frontend (camelCase).
 */

import type { Game, Review, ReviewComment, User, GameList, UserGame, Platform, MonetizationType, VerdictLabel, LibraryStatus } from "../types";
import type { GameRow, ReviewRow, ProfileRow, ListRow, UserGameRow, ReviewCommentRow } from "../supabase/types";
import { isFutureDate } from "../utils";
import { scoreToVerdict } from "../utils/score";
import { getVerdictLabel } from "../utils/scoring";
import { sanitizeDiscoveryDescription } from "../utils/discovery";
import { normalizePlatforms } from "../utils/platform";
import {hasUnreleasedStatus,hasKnownFullRelease} from '../utils/release-status';
import {getPlayerGrowthEvidence} from '../utils/trending';

/**
 * Regenerate verdict summary from display score + title + genres.
 * This ensures the summary text matches the Bayesian-smoothed score
 * shown to the user, not the raw ingest-time score.
 */
function regenerateVerdictSummary(
  title: string,
  displayScore: number,
): string {
  // Ratings summarize reception; they cannot establish gameplay, story or
  // technical quality. Keep the same score/label policy without inventing a review.
  if (displayScore <= 0) return `${title} is awaiting enough rating evidence for a verdict.`;
  return `Verdict ${displayScore}/100, based on the available rating evidence. Provider ratings and review confidence are shown separately.`;
}

/**
 * Sanitize stored pros text at read time to fix legacy "0K reviews" bug
 * and ensure review count text matches actual data.
 */
// Exact strings emitted by the legacy tag-to-review generator. Preserve authored prose.
const GENERATED_TAG_CLAIMS = new Set([
  'Compelling narrative and story', 'Rich open world to explore',
  'Engaging multiplayer/co-op experience', 'Outstanding soundtrack',
  'Standout indie gem', 'Unique gameplay concept',
  'Steep difficulty curve may not appeal to casual players',
  'Can require significant grinding', 'No significant drawbacks reported',
]);

function sanitizePros(pros: string[], reviewCount: number): string[] {
  return pros.filter(p => !GENERATED_TAG_CLAIMS.has(p)).map((p) => {
    p=p.replace(/^Critically acclaimed \((\d+)\/100 critic average\)$/, 'IGDB critic average: $1/100');
    // Fix "from 0K reviews" → use actual count
    if (p.includes("from 0K reviews")) {
      const countStr = reviewCount >= 1000
        ? `${(reviewCount / 1000).toFixed(reviewCount >= 10000 ? 0 : 1)}K`
        : String(reviewCount);
      return p.replace("from 0K reviews", `from ${countStr} reviews`);
    }
    // Fix any other bad "XK reviews" where X is wrong (e.g. stored count differs from current)
    const match = p.match(/(\d+) user reviews on Steam \((\d+)% positive from (\d+)K? reviews\)/);
    if (match) {
      const storedCount = parseInt(match[1]);
      if (storedCount !== reviewCount && reviewCount > 0) {
        const countStr = reviewCount >= 1000
          ? `${(reviewCount / 1000).toFixed(reviewCount >= 10000 ? 0 : 1)}K`
          : String(reviewCount);
        return p.replace(/\d+ user reviews on Steam/, `${countStr} user reviews on Steam`);
      }
    }
    return p;
  });
}

function computeTrendingReason(row: GameRow, label: VerdictLabel): string | undefined {
  if (label === 'COMING SOON' || label === 'CANCELLED') return undefined;
  const r = row as GameRow & { is_trending_manual?: boolean; is_featured_manual?: boolean };
  const momentum = getFreshPlayerSignals(row).momentum;
  const score = (row.verdict_score != null && row.verdict_score > 0)
    ? Math.round(row.verdict_score)
    : displayScore(row.score ?? 0, row.review_count ?? 0);
  const currentPlayers = getFreshPlayerSignals(row).players;
  const reviewCount = row.review_count ?? 0;
  const ageDays = row.release_date
    ? (Date.now() - new Date(`${row.release_date}T00:00:00`).getTime()) / 86400000
    : Number.POSITIVE_INFINITY;

  // Priority: manual > momentum > recency > quality > popularity > deals > fallback

  // 1. Manual overrides (highest intent)
  if (r.is_trending_manual || r.is_featured_manual) return "⭐ Editor's Pick";

  // 2. Recency signals
  if (ageDays < 0) return "Coming Soon";
  if (ageDays <= 30 && (momentum >= 0.05 || currentPlayers >= 500 || reviewCount >= 150)) return "New & Hot";
  if (ageDays <= 30) return "✨ Just Released";

  // 3. Momentum signals
  const growth = getPlayerGrowthEvidence(row);
  if (growth === 'fresh') return "Trending Up";
  if (growth === 'stale') return "Past Momentum";

  // 4. Quality / popularity tiers
  const observationAge = Date.now() - Date.parse(row.players_updated_at ?? '');
  if (currentPlayers > 10000 && observationAge >= 0 && observationAge <= 72 * 60 * 60 * 1000) return "🎮 Popular Now";
  if (score >= 90 && reviewCount >= 150) return "Top Rated";
  if (row.price_deal_url && row.price_lowest != null && score >= 75) return "On Sale";
  if (score >= 82 && reviewCount < 150 && currentPlayers < 5000) return "💎 Hidden Gem";

  // 5. Cooling-off signal — keep this narrow so strong top-rated games do not look weak by default
  if (momentum < -0.35 && currentPlayers >= 2500 && score < 90) return "Falling";

  return undefined;
}

const MIN_REVIEWS_FOR_RAW_SCORE = 50;
const BAYESIAN_PRIOR_WEIGHT = 50;
const BAYESIAN_PRIOR_SCORE = 75;

function displayScore(score: number, reviewCount: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  if (reviewCount >= MIN_REVIEWS_FOR_RAW_SCORE) return score;
  return Math.round(
    (score * reviewCount + BAYESIAN_PRIOR_SCORE * BAYESIAN_PRIOR_WEIGHT) /
      (reviewCount + BAYESIAN_PRIOR_WEIGHT)
  );
}

/** Map a games row to the frontend Game interface. */
export function mapGameRow(row: GameRow): Game {
  const flagProvisional = (row as GameRow & { is_provisional?: boolean }).is_provisional ?? false;
  const releaseStatus = row.release_status?.toLowerCase().replace(/_/g,'-') || undefined;

  /* Stubs may set verdict_label to COMING SOON without is_provisional (e.g. migration 008 not applied). */
  const rowVerdict = row.verdict_label as VerdictLabel | undefined;
  const isComingSoonLabel = rowVerdict === "COMING SOON";

  // Force future/unreleased games into Coming Soon state — no real verdicts until released
  const today = new Date().toISOString().slice(0, 10);
  const isFutureRelease = row.release_date
    ? isFutureDate(row.release_date)
    : false;

  // Games with 0 reviews should not display real verdicts — their score is just a RAWG rating guess
  const reviewCount = row.review_count ?? 0;
  const hasNoReviews = reviewCount === 0;

  // "Just Released" detection: released within the last 14 days but has fewer than 20 reviews.
  // These games are real launches, not junk — they just haven't been fully enriched yet.
  // Crimson Desert is the canonical example: released March 19, but DB only has 6 reviews
  // while Steam actually has 61K. Show "JUST RELEASED" instead of a fake verdict from weak data.
  const JUST_RELEASED_DAYS = 14;
  const JUST_RELEASED_MIN_REVIEWS = 20;
  const isRecentRelease = row.release_date
    ? (() => {
        const releaseMs = new Date(row.release_date + "T00:00:00").getTime();
        const todayMs = new Date(today + "T00:00:00").getTime();
        const daysSinceRelease = (todayMs - releaseMs) / (1000 * 60 * 60 * 24);
        return daysSinceRelease >= 0 && daysSinceRelease <= JUST_RELEASED_DAYS;
      })()
    : false;
  // Recently released (≤14 days) with fewer than 20 reviews → "JUST RELEASED" (including 0 reviews)
  const isJustReleased = isRecentRelease && reviewCount < JUST_RELEASED_MIN_REVIEWS;

  // Provisional: future games, explicit flags, OR old games with 0 reviews (not recent releases)
  const explicitlyUnreleased = hasUnreleasedStatus(row);
  const effectiveProvisional = isFutureRelease || explicitlyUnreleased
    || (!hasKnownFullRelease(row) && (flagProvisional || isComingSoonLabel) && !isRecentRelease);

  // ── Score resolution: prefer verdict_score (v2), fall back to legacy Bayesian ──
  const rawScore = row.score ?? 0;
  const hasV2Score = row.verdict_score != null && Number.isFinite(row.verdict_score) && row.verdict_score > 0;
  const rowConfidence = row.confidence ?? 0;
  // The existing launch window uses 20 reviews as its evidence floor. Do not
  // turn the same tiny fallback sample into a definitive negative verdict
  // simply because that window elapsed. Keep valid critic/Steam evidence.
  const hasCriticEvidence = (row.critic_score ?? row.igdb_rating ?? row.rawg_metacritic ?? 0) > 0;
  const hasSteamEvidence = (row.steam_total_count ?? 0) > 0 || row.user_score != null && reviewCount > 0;
  const insufficientFallbackEvidence = reviewCount < JUST_RELEASED_MIN_REVIEWS && !hasCriticEvidence && !hasSteamEvidence;

  let score: number;
  let verdictLabel: VerdictLabel;

  if (['cancelled','canceled'].includes((releaseStatus || '').toLowerCase())) {
    score = 0;
    verdictLabel = 'CANCELLED';
  } else if (effectiveProvisional) {
    score = 0;
    verdictLabel = "COMING SOON";
  } else if (isJustReleased) {
    score = 0;
    verdictLabel = "JUST RELEASED";
  } else if (insufficientFallbackEvidence || !hasV2Score && (rawScore <= 0 || !Number.isFinite(rawScore) || hasNoReviews)) {
    score = 0;
    verdictLabel = 'NOT YET RATED';
  } else if (hasV2Score) {
    // Use v2 scoring: verdict_score already incorporates Wilson LB + critic blend
    score = Math.round(row.verdict_score!);
    verdictLabel = getVerdictLabel(score, rowConfidence, false, false);
  } else {
    // Legacy fallback for pre-backfill rows
    score = displayScore(rawScore, reviewCount);
    verdictLabel = scoreToVerdict(score) as VerdictLabel;
  }

  const verdictSummary = verdictLabel === 'CANCELLED'
    ? 'Development has been cancelled. Previous release estimates no longer apply.'
    : effectiveProvisional
    ? releaseStatus === 'early-access' ? 'Playable in Early Access. The full release is still pending.' : 'Explore the announced platforms, trailers and release details.'
    : isJustReleased
      ? `${row.title} just launched — verdict pending as review data comes in.`
      : regenerateVerdictSummary(row.title, score);
  const description = sanitizeDiscoveryDescription(row);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    coverImage: row.cover_image,
    // Note: On-the-fly Cloudinary optimization disabled - external sites block fetch.
    // Admin should upload images directly via admin panel for optimization.
    headerImage: row.header_image,
    screenshots: row.screenshots ?? [],
    platforms: normalizePlatforms(row.platforms as string[]),
    genres: row.genres,
    tags: row.tags,
    developer: row.developer,
    publisher: row.publisher,
    releaseDate: row.release_date ?? "",
    description,
    score,
    verdictLabel,
    verdictSummary: verdictSummary,
    pros: sanitizePros(row.pros ?? [], reviewCount),
    // Suppress the exact legacy auto-generated assertion until stored repair.
    // Editorial/user prose and actual release metadata are preserved.
    cons: (row.cons ?? []).filter(con => con !== "Still in Early Access — content may be incomplete" && !GENERATED_TAG_CLAIMS.has(con)),
    monetization: row.monetization as MonetizationType,
    performanceNotes: row.performance_notes ?? "",
    monetizationNotes: row.monetization_notes ?? "",
    steamUrl: row.steam_url ?? undefined,
    playStoreUrl: row.play_store_url ?? undefined,
    steamAppId: row.steam_app_id ?? undefined,
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
    trendingReason: computeTrendingReason(row, verdictLabel),

    // Momentum
    momentum: row.momentum ?? undefined,

    // Provisional/upcoming (COMING SOON label alone counts — see effectiveProvisional)
    isProvisional: effectiveProvisional,
    releaseStatus,

    // Verdict Scoring v2
    confidence: rowConfidence > 0 ? rowConfidence : undefined,
    communityScore: row.community_score != null ? Math.round(row.community_score) : undefined,
    criticScore: row.critic_score != null ? Math.round(row.critic_score) : undefined,
    verdictScore: hasV2Score && score > 0 ? score : undefined,
  };
}

/** Map a reviews row (with joined game & profile data) to the frontend Review interface. */
export function mapReviewRow(
  row: ReviewRow & {
    game?: { slug: string; title: string; cover_image: string } | null;
    profile?: { username: string; display_name?: string; avatar_url: string } | null;
    vote_up_count?: number;
    vote_down_count?: number;
    user_vote_value?: number | null;
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
    displayName: row.profile?.display_name || row.profile?.username || "",
    userAvatar: row.profile?.avatar_url ?? "",
    rating: row.rating,
    title: row.title,
    body: row.body,
    pros: row.pros.length > 0 ? row.pros : undefined,
    cons: row.cons.length > 0 ? row.cons : undefined,
    helpful: row.vote_up_count ?? row.helpful ?? 0,
    notHelpful: row.vote_down_count ?? 0,
    userVote: (row.user_vote_value === 1 ? 1 : row.user_vote_value === -1 ? -1 : 0) as -1 | 0 | 1,
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
  row: Omit<ProfileRow, "auth_id" | "role">,
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
  // Use list's own cover, or fall back to a game's header image (landscape, better for thumbnails)
  const coverImage = row.cover_image
    || games.find((g) => g.headerImage)?.headerImage
    || games.find((g) => g.coverImage)?.coverImage
    || "";

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    previewText: row.preview_text,
    bodyText: row.body_text,
    coverImage,
    gameCount: games.length,
    games,
    curatedBy: row.curated_by,
    createdAt: row.created_at,
    tags: row.tags,
    ownerId: row.owner_id ?? undefined,
    isPublic: row.is_public,
    isSystemManaged: row.is_system_managed,
    systemKey: row.system_key ?? undefined,
    managedBy: row.managed_by ?? undefined,
    seedVersion: row.seed_version ?? undefined,
    seedHash: row.seed_hash ?? undefined,
    lastSeededAt: row.last_seeded_at ?? undefined,
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
