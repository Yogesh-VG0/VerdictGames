import type { MonetizationType, Platform, SearchFilters, SortOption } from "@/lib/types";

export type SearchBrowseTab = "games" | "deals" | "free";

export interface SearchGamesState {
  query: string;
  platform: Platform | "All";
  genre: string;
  year: string;
  monetization: MonetizationType | "All";
  sort: SortOption;
  page: number;
}

export interface SearchPageState {
  browseTab: SearchBrowseTab;
  games: SearchGamesState;
}

type SearchParamRecord = Record<string, string | string[] | undefined>;

type SearchParamSource =
  | URLSearchParams
  | SearchParamRecord
  | { get(name: string): string | null }
  | null
  | undefined;

const VALID_BROWSE_TABS = new Set<SearchBrowseTab>(["games", "deals", "free"]);
const VALID_SORTS = new Set<SortOption>(["relevance", "newest", "upcoming", "recently-added", "top-rated", "trending"]);
const VALID_PLATFORMS = new Set<Platform | "All">([
  "All",
  "PC",
  "PlayStation 5",
  "PlayStation 4",
  "Xbox Series X|S",
  "Xbox One",
  "Nintendo Switch",
  "Nintendo Switch 2",
  "Android",
  "iOS",
  "macOS",
  "Linux",
]);
const VALID_MONETIZATION = new Set<MonetizationType | "All">([
  "All",
  "Free",
  "Paid",
  "Free with IAP",
  "Free with Ads",
  "Subscription",
  "Unknown",
]);
const INDEXABLE_SORTS = new Set<SortOption>(["relevance", "newest", "upcoming", "recently-added", "top-rated", "trending"]);

export const DEFAULT_SEARCH_GAMES_STATE: SearchGamesState = {
  query: "",
  platform: "All",
  genre: "",
  year: "",
  monetization: "All",
  sort: "relevance",
  page: 1,
};

export const DEFAULT_SEARCH_PAGE_STATE: SearchPageState = {
  browseTab: "games",
  games: DEFAULT_SEARCH_GAMES_STATE,
};

function isSearchParamRecord(source: SearchParamSource): source is SearchParamRecord {
  return typeof source === "object"
    && source !== null
    && !(source instanceof URLSearchParams)
    && !(("get" in source) && typeof source.get === "function");
}

function readParam(source: SearchParamSource, key: string): string | undefined {
  if (!source) {
    return undefined;
  }

  if (source instanceof URLSearchParams) {
    return source.get(key) ?? undefined;
  }

  if (typeof source === "object" && "get" in source && typeof source.get === "function") {
    return source.get(key) ?? undefined;
  }

  if (!isSearchParamRecord(source)) {
    return undefined;
  }

  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}

function sanitizeSearchQuery(query: string | null | undefined): string {
  return (query ?? "").replace(/[%_(),.;'"\\|{}\[\]]/g, "").trim().slice(0, 200);
}

function normalizeBrowseTab(value: string | null | undefined): SearchBrowseTab {
  return VALID_BROWSE_TABS.has((value ?? "") as SearchBrowseTab) ? (value as SearchBrowseTab) : "games";
}

function normalizePlatform(value: string | null | undefined): Platform | "All" {
  return VALID_PLATFORMS.has((value ?? "") as Platform | "All") ? (value as Platform | "All") : "All";
}

function normalizeMonetization(value: string | null | undefined): MonetizationType | "All" {
  return VALID_MONETIZATION.has((value ?? "") as MonetizationType | "All") ? (value as MonetizationType | "All") : "All";
}

function normalizeSort(value: string | null | undefined): SortOption {
  return VALID_SORTS.has((value ?? "") as SortOption) ? (value as SortOption) : "relevance";
}

function normalizePage(value: number | string | null | undefined): number {
  const candidate = typeof value === "number" ? value : Number.parseInt(String(value ?? "1"), 10);
  if (!Number.isFinite(candidate) || candidate < 1) {
    return 1;
  }

  return Math.min(candidate, 100);
}

function normalizeYear(value: string | null | undefined): string {
  const candidate = (value ?? "").trim();
  return /^\d{4}$/.test(candidate) ? candidate : "";
}

function normalizeFreeText(value: string | null | undefined, limit: number): string {
  return (value ?? "").trim().slice(0, limit);
}

function appendGamesParams(params: URLSearchParams, games: SearchGamesState) {
  if (games.query) {
    params.set("q", games.query);
  }

  if (games.platform !== "All") {
    params.set("platform", games.platform);
  }

  if (games.genre) {
    params.set("genre", games.genre);
  }

  if (games.year) {
    params.set("year", games.year);
  }

  if (games.monetization !== "All") {
    params.set("monetization", games.monetization);
  }

  if (games.sort !== "relevance") {
    params.set("sort", games.sort);
  }

  if (games.page > 1) {
    params.set("page", String(games.page));
  }
}

export function normalizeSearchGamesState(input: {
  query?: string | null;
  platform?: string | null;
  genre?: string | null;
  year?: string | null;
  monetization?: string | null;
  sort?: string | null;
  page?: number | string | null;
}): SearchGamesState {
  return {
    query: sanitizeSearchQuery(input.query),
    platform: normalizePlatform(input.platform),
    genre: normalizeFreeText(input.genre, 80),
    year: normalizeYear(input.year),
    monetization: normalizeMonetization(input.monetization),
    sort: normalizeSort(input.sort),
    page: normalizePage(input.page),
  };
}

export function parseSearchPageState(source: SearchParamSource): SearchPageState {
  return {
    browseTab: normalizeBrowseTab(readParam(source, "tab")),
    games: normalizeSearchGamesState({
      query: readParam(source, "q"),
      platform: readParam(source, "platform"),
      genre: readParam(source, "genre"),
      year: readParam(source, "year"),
      monetization: readParam(source, "monetization"),
      sort: readParam(source, "sort"),
      page: readParam(source, "page"),
    }),
  };
}

export function searchGamesStateToFilters(state: SearchGamesState): SearchFilters {
  return {
    query: state.query || undefined,
    platform: state.platform,
    genre: state.genre || undefined,
    year: state.year || undefined,
    monetization: state.monetization,
    sort: state.sort,
    page: state.page,
  };
}

export function buildSearchPageQueryString(state: SearchPageState): string {
  const params = new URLSearchParams();

  if (state.browseTab !== "games") {
    params.set("tab", state.browseTab);
    return params.toString();
  }

  appendGamesParams(params, state.games);
  return params.toString();
}

export function buildSearchPagePath(state: SearchPageState): string {
  const queryString = buildSearchPageQueryString(state);
  return queryString ? `/search?${queryString}` : "/search";
}

export function buildSearchApiPath(filters: SearchFilters): string {
  const params = new URLSearchParams();
  appendGamesParams(
    params,
    normalizeSearchGamesState({
      query: filters.query ?? null,
      platform: filters.platform ?? null,
      genre: filters.genre ?? null,
      year: filters.year ?? null,
      monetization: filters.monetization ?? null,
      sort: filters.sort ?? null,
      page: filters.page ?? null,
    })
  );

  const queryString = params.toString();
  return queryString ? `/api/search?${queryString}` : "/api/search";
}

export function isIndexableSearchState(state: SearchPageState): boolean {
  return state.browseTab === "games"
    && state.games.page === 1
    && !state.games.query
    && state.games.platform === "All"
    && !state.games.genre
    && !state.games.year
    && state.games.monetization === "All"
    && INDEXABLE_SORTS.has(state.games.sort);
}

export function getSearchRobotsRule(state: SearchPageState): "index,follow" | "noindex,follow" {
  return isIndexableSearchState(state) ? "index,follow" : "noindex,follow";
}

export function getSearchSeoCopy(state: SearchPageState): { title: string; description: string } {
  const pageSuffix = state.games.page > 1 ? ` - Page ${state.games.page}` : "";

  if (state.browseTab !== "games") {
    if (state.browseTab === "deals") {
      return {
        title: "Game Deals",
        description: "Browse live game deals and discounts on verdict.games.",
      };
    }

    return {
      title: "Free to Play Games",
      description: "Browse free-to-play and subscription-included games on verdict.games.",
    };
  }

  if (state.games.query) {
    return {
      title: `Search results for \"${state.games.query}\"${pageSuffix}`,
      description: `Search results for \"${state.games.query}\" on verdict.games. Filter by platform, genre, year, price, and verdict score.`,
    };
  }

  if (state.games.platform !== "All" || state.games.genre || state.games.year || state.games.monetization !== "All") {
    return {
      title: `Filtered Game Search${pageSuffix}`,
      description: "Search and filter games by platform, genre, year, price, and verdict score on verdict.games.",
    };
  }

  switch (state.games.sort) {
    case "trending":
      return {
        title: `Trending Games${pageSuffix}`,
        description: "Browse trending games gaining momentum right now on verdict.games.",
      };
    case "top-rated":
      return {
        title: `Top Rated Games${pageSuffix}`,
        description: "Browse the highest-rated games with strong popularity and current relevance on verdict.games.",
      };
    case "newest":
      return {
        title: `New Releases${pageSuffix}`,
        description: "Browse the latest released games on verdict.games.",
      };
    case "upcoming":
      return {
        title: `Upcoming Games${pageSuffix}`,
        description: "Browse upcoming games and future releases on verdict.games.",
      };
    case "recently-added":
      return {
        title: `Recently Added Games${pageSuffix}`,
        description: "Browse the latest games added to verdict.games.",
      };
    default:
      return {
        title: `Search Games${pageSuffix}`,
        description: "Search and filter games by genre, platform, year, and more on verdict.games.",
      };
  }
}
