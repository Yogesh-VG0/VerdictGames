/* ═══════════════════════════════════════════════════
   VERDICT.GAMES — Type Definitions
   Single source of truth for all data shapes
   ═══════════════════════════════════════════════════ */

export type Platform =
  | "PC"
  | "PlayStation 5"
  | "PlayStation 4"
  | "Xbox Series X|S"
  | "Xbox One"
  | "Nintendo Switch"
  | "Nintendo Switch 2"
  | "Android"
  | "iOS"
  | "macOS"
  | "Linux";

export type MonetizationType =
  | "Free"
  | "Paid"
  | "Free with IAP"
  | "Free with Ads"
  | "Subscription"
  | "Unknown";

export type VerdictLabel = "MUST PLAY" | "WORTH IT" | "MIXED" | "SKIP" | "COMING SOON" | "JUST RELEASED";

export type SortOption = "relevance" | "newest" | "upcoming" | "recently-added" | "top-rated" | "trending";

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
  appStoreUrl?: string;

  // Metadata
  steamAppId?: number;
  reviewCount: number;
  userScore?: number;
  featured?: boolean;
  trending?: boolean;
  rawgId?: number;
  isPreview?: boolean;
  previewSource?: "rawg" | "igdb";

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

  // Trending/freshness signals
  trendingReason?: string;
  isFeaturedManual?: boolean;
  isTrendingManual?: boolean;

  // Momentum (rate of player count change)
  momentum?: number;

  // Provisional / upcoming game
  isProvisional?: boolean;
  releaseStatus?: string; // 'upcoming' | 'tba' | 'announced'

  // Verdict Scoring v2
  confidence?: number;       // 0.0-1.0, how much we trust the verdict
  communityScore?: number;   // Wilson LB community score, 0-100
  criticScore?: number;      // normalized critic score, 0-100
  verdictScore?: number;     // final blended score, 0-100
}

export interface Review {
  id: string;
  gameId: string;
  gameSlug: string;
  gameTitle: string;
  gameCover: string;
  userId: string;
  username: string;
  displayName: string;
  userAvatar: string;
  rating: number; // 0–100
  title: string;
  body: string;
  pros?: string[];
  cons?: string[];
  helpful: number;
  notHelpful: number;
  userVote: -1 | 0 | 1;  // current user's vote: 1=helpful, -1=not, 0=none
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
  previewText: string;
  bodyText: string;
  coverImage: string;
  gameCount: number;
  games: Game[];
  curatedBy: string;
  createdAt: string;
  tags: string[];
  ownerId?: string;
  isPublic?: boolean;
  isSystemManaged?: boolean;
  systemKey?: string;
  managedBy?: string;
  seedVersion?: number;
  seedHash?: string;
  lastSeededAt?: string;
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
  totalIsExact?: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  profileId: string;
  username: string;
  displayName: string;
  avatar: string;
  role?: "user" | "admin";
}

/* ═══════════════════════════════════════════════════
   GX CORNER — Live feed types (not stored in DB)
   ═══════════════════════════════════════════════════ */

export interface GXDeal {
  id: string;
  title: string;
  cover: string | null;
  discount: number | null;
  price: number | null;
  currency: string | null;
  buyUrl: string | null;
  storeName: string | null;
  storeColor: string | null;
  badge: string | null;
  dealType: string | null;
  genres: string[];
  platforms: string[];
}

export interface GXNewsItem {
  id: number;
  title: string;
  image: string;
  url: string;
  publisherName: string;
  publisherFavicon: string;
  related?: { name: string; url: string; icon: string }[];
}

export interface GXTopGame {
  id: string;
  title: string;
  cover: string | null;
  url: string | null;
  serviceName: string | null;
  serviceColor: string | null;
  serviceTag: string | null;
  genres: string[];
  platforms: string[];
}

export interface GXFreeGame {
  id: string;
  title: string;
  cover: string | null;
  url: string | null;
  ctaLabel: string | null;
  genres: string[];
  platforms: string[];
}

export interface GXMostLiked {
  id: string;
  title: string;
  slug: string;
  cover: string;
  url: string;
  releaseDate: string | null;
  likes: number;
  genres: string[];
}

export interface GXCalendarGame {
  title: string;
  slug: string | null;
  cover: string | null;
  releaseDate: string;
  originalReleaseDate: string | null;
  hotGame: boolean;
  url: string | null;
  ctaLabel: string | null;
  tagLabel: string | null;
  tagColor: string | null;
  genres: string[];
  platforms: string[];
}

export type GXCalendarSource = "live" | "snapshot" | "empty";

export interface GXCalendarMonthResponse {
  month: string;
  items: GXCalendarGame[];
  source: GXCalendarSource;
  fetchedAt?: string;
}

export interface CalendarGame extends Game {
  calendarOriginalReleaseDate?: string;
  calendarEntryTag?: string | null;
  calendarEntryTagColor?: string | null;
  calendarEntryPlatforms?: Platform[];
  calendarEntryPlatformNames?: string[];
  calendarUrl?: string | null;
  calendarCtaLabel?: string | null;
  calendarIsHot?: boolean;
  calendarHasDetailPage?: boolean;
}

export interface CalendarMonthResponse {
  month: string;
  items: CalendarGame[];
  gxSource: GXCalendarSource;
  gxCount: number;
  dbCount: number;
  gxFetchedAt?: string;
}
