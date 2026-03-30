import { DEFAULT_SEARCH_GAMES_STATE, buildSearchPagePath } from "@/lib/search";

export const SHARED_NAV_LABELS = {
  browse: "Browse",
  deals: "Deals",
  freeToPlay: "Free to Play",
} as const;

export const SHARED_NAV_DESTINATIONS = {
  browse: buildSearchPagePath({
    browseTab: "games",
    games: DEFAULT_SEARCH_GAMES_STATE,
  }),
  deals: buildSearchPagePath({
    browseTab: "deals",
    games: DEFAULT_SEARCH_GAMES_STATE,
  }),
  freeToPlay: buildSearchPagePath({
    browseTab: "free",
    games: DEFAULT_SEARCH_GAMES_STATE,
  }),
} as const;
