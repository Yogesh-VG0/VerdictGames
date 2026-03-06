/* ═══════════════════════════════════════════════════
   VERDICT.GAMES — Type Definitions
   Single source of truth for all data shapes
   ═══════════════════════════════════════════════════ */

export type Platform = "PC" | "Android";

export type MonetizationType =
  | "Free"
  | "Paid"
  | "Free with IAP"
  | "Free with Ads"
  | "Subscription";

export type VerdictLabel = "MUST PLAY" | "WORTH IT" | "MIXED" | "SKIP";

export type SortOption = "relevance" | "newest" | "top-rated" | "trending";

export type LibraryStatus = "wishlist" | "playing" | "completed" | "dropped" | "paused";

export interface Game {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  coverImage: string;
  headerImage: string;
  screenshots: string[];
  platforms: Platform[];
  genres: string[];
  tags: string[];
  developer: string;
  publisher: string;
  releaseDate: string;
  description: string;

  // Verdict
  score: number; // 0–100
  verdictLabel: VerdictLabel;
  verdictSummary: string;
  pros: string[];
  cons: string[];

  // Detail sections
  monetization: MonetizationType;
  performanceNotes: string;
  monetizationNotes: string;

  // External links
  steamUrl?: string;
  playStoreUrl?: string;

  // Metadata
  reviewCount: number;
  userScore?: number;
  featured?: boolean;
  trending?: boolean;

  // Price & Deals (multi-source)
  priceCurrent?: number;     // cents
  priceCurrency?: string;
  priceLowest?: number;      // cents
  priceDealUrl?: string;
  isFree?: boolean;

  // Player counts (Steam)
  currentPlayers?: number;
  peakPlayers24h?: number;
  playersUpdatedAt?: string;

  // Media
  trailerUrl?: string;
  trailerThumbnail?: string;

  // IGDB
  igdbRating?: number;
  igdbUrl?: string;

  // Extended info
  wikipediaUrl?: string;
  wikipediaExcerpt?: string;
  metacriticUrl?: string;
  websiteUrl?: string;
  redditUrl?: string;

  // Per-source scores
  steamRatingLabel?: string;
  rawgMetacritic?: number;
  rawgRating?: number;
  scoreSource?: string;

  // Enrichment tracking
  lastEnrichedAt?: string;
  enrichmentSources?: string[];

  // HLTB
  hltbMain?: number;
  hltbExtras?: number;
  hltbCompletionist?: number;

  // Franchise
  franchise?: string;
}

export interface Review {
  id: string;
  gameId: string;
  gameSlug: string;
  gameTitle: string;
  gameCover: string;
  userId: string;
  username: string;
  userAvatar: string;
  rating: number; // 0–100
  title: string;
  body: string;
  pros?: string[];
  cons?: string[];
  helpful: number;
  createdAt: string;
  platform: Platform;
}

export interface ReviewComment {
  id: string;
  reviewId: string;
  userId: string;
  username: string;
  userAvatar: string;
  body: string;
  parentId?: string;
  createdAt: string;
  replies?: ReviewComment[];
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  gamesReviewed: number;
  listsCreated: number;
  joinedAt: string;
  favoriteGenres: string[];
  recentActivity: ActivityItem[];
  followerCount?: number;
  followingCount?: number;
  libraryCount?: number;
}

export interface ActivityItem {
  id: string;
  type: "review" | "list" | "rating" | "library";
  gameSlug?: string;
  gameTitle?: string;
  listSlug?: string;
  listTitle?: string;
  rating?: number;
  status?: LibraryStatus;
  createdAt: string;
}

export interface GameList {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImage: string;
  gameCount: number;
  games: Game[];
  curatedBy: string;
  createdAt: string;
  tags: string[];
  ownerId?: string;
  isPublic?: boolean;
}

export interface UserGame {
  id: string;
  userId: string;
  gameId: string;
  game?: Game;
  status: LibraryStatus;
  personalRating?: number;
  hoursPlayed: number;
  notes: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface LibraryStats {
  total: number;
  wishlist: number;
  playing: number;
  completed: number;
  dropped: number;
  paused: number;
  totalHours: number;
  averageRating: number;
  genreBreakdown: Record<string, number>;
}

export interface SearchFilters {
  query?: string;
  platform?: Platform | "All";
  genre?: string;
  year?: string;
  monetization?: MonetizationType | "All";
  sort?: SortOption;
  page?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  profileId: string;
  username: string;
  displayName: string;
  avatar: string;
}
