"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight, Clock, ExternalLink, Flame, Gamepad2, Gift, RotateCcw, Search as SearchIcon, Sparkles, Tag, Trophy } from "lucide-react";
import FilterChips from "@/components/ui/FilterChips";
import GameGrid from "@/components/GameGrid";
import GXDealCard from "@/components/GXDealCard";
import SectionHeader from "@/components/SectionHeader";
import SortDropdown from "@/components/ui/SortDropdown";
import { GameGridSkeleton } from "@/components/ui/Skeleton";
import { PLATFORM_FILTER_OPTIONS, platformFilterIcon } from "@/components/ui/PlatformIcon";
import { searchGames, getGXDeals, getGXFreeToPlay, getGXTopGames } from "@/lib/api";
import { buildSearchApiPath, buildSearchPagePath, normalizeSearchGamesState, searchGamesStateToFilters, type SearchBrowseTab, type SearchPageState } from "@/lib/search";
import type { Game, MonetizationType, Platform, SortOption, PaginatedResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/utils/slugify";

const allGenres: string[] = [
  "Action", "Action RPG", "Adventure", "Battle Royale", "Card Game",
  "Detective", "Endless Runner", "Horror", "Indie", "Metroidvania",
  "MMORPG", "Open World", "Party", "Platformer", "Puzzle",
  "Roguelike", "RPG", "Sandbox", "Shooter", "Simulation",
  "Social Deduction", "Strategy", "Survival", "Turn-Based Strategy",
];

const allYears: string[] = [
  "2026", "2025", "2024", "2023", "2022", "2021", "2020",
  "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011",
];

type FreeSubTab = "free" | "subscriptions";
type DealsSortMode = "discount" | "price-low" | "price-high" | "name";

const DEALS_SORT_OPTIONS: { value: DealsSortMode; label: string }[] = [
  { value: "discount", label: "Biggest Discount" },
  { value: "price-low", label: "Price: Low → High" },
  { value: "price-high", label: "Price: High → Low" },
  { value: "name", label: "A → Z" },
];

const MONETIZATION_OPTIONS = ["All", "Free", "Paid"] as const;
const RESET_FILTERS_LABEL = "Reset filters";
const RESET_FILTERS_BUTTON_CLASS = "inline-flex items-center gap-1.5 px-4 py-2 text-sm text-accent border border-accent rounded-full hover:bg-accent/10 transition-colors";

function getSearchPageHeader(browseTab: SearchBrowseTab, freeSubTab: FreeSubTab, sort: SortOption) {
  if (browseTab === "deals") {
    return {
      title: "Game Deals",
      subtitle: "Browse live discounts and narrow them by store or genre.",
      gradient: "linear-gradient(90deg, #22c55e 0%, #84cc16 50%, #f59e0b 100%)",
      icon: <Tag className="w-6 h-6 text-pixel-green" />,
    };
  }

  if (browseTab === "free") {
    if (freeSubTab === "subscriptions") {
      return {
        title: "Included with Subscription",
        subtitle: "Browse Game Pass and PlayStation Plus picks by service or genre.",
        gradient: "linear-gradient(90deg, #8b5cf6 0%, #6366f1 50%, #06b6d4 100%)",
        icon: <Gamepad2 className="w-6 h-6 text-accent" />,
      };
    }

    return {
      title: "Free to Play",
      subtitle: "Browse free games across platforms and narrow the list by genre.",
      gradient: "linear-gradient(90deg, #06b6d4 0%, #22c55e 50%, #38bdf8 100%)",
      icon: <Gift className="w-6 h-6 text-pixel-cyan" />,
    };
  }

  switch (sort) {
    case "trending":
      return {
        title: "Trending Games",
        subtitle: "Games gaining momentum right now based on player activity.",
        gradient: "linear-gradient(90deg, #f97316, #ef4444, #f97316)",
        icon: <Flame className="w-6 h-6 text-orange-500" />,
      };
    case "top-rated":
      return {
        title: "Top Rated Games",
        subtitle: "Highest Verdict scores across all platforms.",
        gradient: "linear-gradient(90deg, #facc15, #f97316, #22c55e)",
        icon: <Trophy className="w-6 h-6 text-yellow-500" />,
      };
    case "newest":
      return {
        title: "New Releases",
        subtitle: "The latest released games, sorted by release date.",
        gradient: "linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6)",
        icon: <Sparkles className="w-6 h-6 text-cyan-500" />,
      };
    case "upcoming":
      return {
        title: "Upcoming Games",
        subtitle: "Unreleased games arriving soonest.",
        gradient: "linear-gradient(90deg, #a855f7, #6366f1, #ec4899)",
        icon: <Calendar className="w-6 h-6 text-purple-500" />,
      };
    case "recently-added":
      return {
        title: "Recently Added",
        subtitle: "Latest games added to Verdict — not necessarily new releases.",
        gradient: "linear-gradient(90deg, #3b82f6, #06b6d4, #3b82f6)",
        icon: <Clock className="w-6 h-6 text-blue-500" />,
      };
    default:
      return {
        title: "Browse Games",
        subtitle: "Search, filter, and sort games across all platforms.",
        gradient: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 25%, #a78bfa 50%, #8b5cf6 75%, #6366f1 100%)",
        icon: <SearchIcon className="w-6 h-6 text-accent" />,
      };
  }
}

interface SearchClientPageProps {
  initialState: SearchPageState;
  initialGamesData: PaginatedResponse<Game> | null;
}

export default function SearchClientPage({ initialState, initialGamesData }: SearchClientPageProps) {
  const router = useRouter();

  const [browseTab, setBrowseTab] = useState<SearchBrowseTab>(initialState.browseTab);
  const [query, setQuery] = useState(initialState.games.query);
  const [debouncedQuery, setDebouncedQuery] = useState(initialState.games.query);
  const [platform, setPlatform] = useState<Platform | "All">(initialState.games.platform);
  const [genre, setGenre] = useState(initialState.games.genre);
  const [year, setYear] = useState(initialState.games.year);
  const [monetization, setMonetization] = useState<MonetizationType | "All">(initialState.games.monetization);
  const [sort, setSort] = useState<SortOption>(initialState.games.sort);
  const [page, setPage] = useState(initialState.games.page);

  const [gxGenre, setGxGenre] = useState<string>("All");
  const [gxPlatform, setGxPlatform] = useState<string>("All");
  const [gxStore, setGxStore] = useState<string>("All");
  const [dealsSortMode, setDealsSortMode] = useState<DealsSortMode>("discount");
  const [freeSubTab, setFreeSubTab] = useState<FreeSubTab>("free");
  const [gxService, setGxService] = useState<string>("All");

  const dealsGenreRef = useRef<HTMLDivElement>(null);
  const freeGenreRef = useRef<HTMLDivElement>(null);

  const scrollContainer = (ref: React.RefObject<HTMLDivElement | null>, direction: "left" | "right") => {
    if (!ref.current) return;
    const scrollAmount = 200;
    ref.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(normalizeSearchGamesState({ query }).query);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const normalizedGamesState = useMemo(
    () => normalizeSearchGamesState({ query: debouncedQuery, platform, genre, year, monetization, sort, page }),
    [debouncedQuery, platform, genre, year, monetization, sort, page]
  );
  const filters = useMemo(() => searchGamesStateToFilters(normalizedGamesState), [normalizedGamesState]);
  const searchApiPath = useMemo(() => buildSearchApiPath(filters), [filters]);
  const initialSearchApiPath = useMemo(
    () => buildSearchApiPath(searchGamesStateToFilters(initialState.games)),
    [initialState.games]
  );
  const normalizedPagePath = useMemo(
    () => buildSearchPagePath({ browseTab, games: normalizedGamesState }),
    [browseTab, normalizedGamesState]
  );
  const shouldUseInitialGamesData = browseTab === "games" && searchApiPath === initialSearchApiPath;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["search", searchApiPath],
    queryFn: () => searchGames(filters),
    enabled: browseTab === "games",
    placeholderData: (prev) => prev,
    initialData: shouldUseInitialGamesData ? initialGamesData ?? undefined : undefined,
    staleTime: 30_000,
  });

  const games = data?.items ?? [];
  const totalCount = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;
  const totalPages = Math.ceil(totalCount / (data?.pageSize ?? 25));

  const resetFilters = useCallback(() => {
    setPlatform("All");
    setGenre("");
    setYear("");
    setMonetization("All");
    setSort("relevance");
    setPage(1);
  }, []);

  const { data: dealsData, isLoading: dealsLoading } = useQuery({
    queryKey: ["gx-deals-browse"],
    queryFn: () => getGXDeals(),
    staleTime: 60 * 60 * 1000,
    enabled: browseTab === "deals",
  });

  const { data: freeData, isLoading: freeLoading } = useQuery({
    queryKey: ["gx-free-browse"],
    queryFn: () => getGXFreeToPlay(),
    staleTime: 60 * 60 * 1000,
    enabled: browseTab === "free",
  });

  const { data: topGamesData, isLoading: topGamesLoading } = useQuery({
    queryKey: ["gx-top-games-browse"],
    queryFn: () => getGXTopGames(),
    staleTime: 60 * 60 * 1000,
    enabled: browseTab === "free" && freeSubTab === "subscriptions",
  });

  const availableStores = useMemo(() => {
    if (!dealsData) return [];
    const set = new Set<string>();
    dealsData.forEach((deal) => {
      if (deal.storeName) set.add(deal.storeName);
    });
    return Array.from(set).sort();
  }, [dealsData]);

  const availableServices = useMemo(() => {
    if (!topGamesData) return [];
    const set = new Set<string>();
    topGamesData.forEach((game) => {
      if (game.serviceName) set.add(game.serviceName);
    });
    return Array.from(set).sort();
  }, [topGamesData]);

  const availableDealsGenres = useMemo(() => {
    if (!dealsData) return [];
    const set = new Set<string>();
    dealsData.forEach((deal) => deal.genres.forEach((candidate) => set.add(candidate)));
    return Array.from(set).sort();
  }, [dealsData]);

  const availableFreeGenres = useMemo(() => {
    const source = freeSubTab === "free" ? freeData : topGamesData;
    if (!source) return [];
    const set = new Set<string>();
    source.forEach((game) => game.genres.forEach((candidate) => set.add(candidate)));
    return Array.from(set).sort();
  }, [freeData, topGamesData, freeSubTab]);

  const filteredDeals = useMemo(() => {
    if (!dealsData) return [];
    const result = dealsData.filter((deal) => {
      if (gxStore !== "All" && deal.storeName !== gxStore) return false;
      if (gxGenre !== "All") {
        const hasGenre = deal.genres.some((candidate) => candidate.toLowerCase().includes(gxGenre.toLowerCase()));
        if (!hasGenre) return false;
      }
      if (gxPlatform !== "All") {
        const hasPlatform = deal.platforms.some((candidate) => candidate.toLowerCase().includes(gxPlatform.toLowerCase()));
        if (!hasPlatform) return false;
      }
      return true;
    });

    switch (dealsSortMode) {
      case "discount":
        result.sort((left, right) => (right.discount ?? 0) - (left.discount ?? 0));
        break;
      case "price-low":
        result.sort((left, right) => (left.price ?? 999) - (right.price ?? 999));
        break;
      case "price-high":
        result.sort((left, right) => (right.price ?? 0) - (left.price ?? 0));
        break;
      case "name":
        result.sort((left, right) => left.title.localeCompare(right.title));
        break;
    }

    return result;
  }, [dealsData, gxGenre, gxPlatform, gxStore, dealsSortMode]);

  const filteredFreeGames = useMemo(() => {
    if (!freeData) return [];
    return freeData.filter((game) => {
      if (gxGenre !== "All") {
        const hasGenre = game.genres.some((candidate) => candidate.toLowerCase().includes(gxGenre.toLowerCase()));
        if (!hasGenre) return false;
      }
      if (gxPlatform !== "All") {
        const hasPlatform = game.platforms.some((candidate) => candidate.toLowerCase().includes(gxPlatform.toLowerCase()));
        if (!hasPlatform) return false;
      }
      return true;
    });
  }, [freeData, gxGenre, gxPlatform]);

  const filteredSubscriptionGames = useMemo(() => {
    if (!topGamesData) return [];
    return topGamesData.filter((game) => {
      if (gxService !== "All" && game.serviceName !== gxService) return false;
      if (gxGenre !== "All") {
        const hasGenre = game.genres.some((candidate) => candidate.toLowerCase().includes(gxGenre.toLowerCase()));
        if (!hasGenre) return false;
      }
      if (gxPlatform !== "All") {
        const hasPlatform = game.platforms.some((candidate) => candidate.toLowerCase().includes(gxPlatform.toLowerCase()));
        if (!hasPlatform) return false;
      }
      return true;
    });
  }, [topGamesData, gxGenre, gxPlatform, gxService]);

  const handleFreeSubTabChange = (tab: FreeSubTab) => {
    setFreeSubTab(tab);
    setGxGenre("All");
    setGxPlatform("All");
    setGxService("All");
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (currentPath === normalizedPagePath) {
        return;
      }
    }

    router.replace(normalizedPagePath, { scroll: false });
  }, [normalizedPagePath, router]);

  const isInitialLoad = browseTab === "games" && isLoading && !data;
  const pageHeader = useMemo(() => getSearchPageHeader(browseTab, freeSubTab, sort), [browseTab, freeSubTab, sort]);

  const resetDealsFilters = useCallback(() => {
    setGxGenre("All");
    setGxPlatform("All");
    setGxStore("All");
  }, []);

  const resetFreeFilters = useCallback(() => {
    setGxGenre("All");
    setGxPlatform("All");
  }, []);

  const resetSubscriptionFilters = useCallback(() => {
    setGxGenre("All");
    setGxPlatform("All");
    setGxService("All");
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 sm:py-10 space-y-8 overflow-x-hidden page-enter">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-0"
      >
        <SectionHeader
          title={pageHeader.title}
          icon={pageHeader.icon}
          subtitle={pageHeader.subtitle}
          gradient={pageHeader.gradient}
          headingTag="h1"
          className="mb-0"
        />
      </motion.div>

      <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {([
          { key: "games" as SearchBrowseTab, label: "Browse", icon: SearchIcon },
          { key: "deals" as SearchBrowseTab, label: "Deals", icon: Tag },
          { key: "free" as SearchBrowseTab, label: "Free to Play", icon: Gift },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setBrowseTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border",
              browseTab === key
                ? key === "deals"
                  ? "bg-pixel-green/15 text-pixel-green border-pixel-green/30 shadow-sm"
                  : key === "free"
                    ? "bg-pixel-cyan/15 text-pixel-cyan border-pixel-cyan/30 shadow-sm"
                    : "bg-accent/15 text-accent border-accent/30 shadow-sm"
                : "bg-surface border-border text-secondary hover:text-foreground hover:border-border-hover"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {browseTab === "games" && (
      <div className="sticky z-40 bg-background/80 backdrop-blur-xl py-3 -mx-4 px-4 border-b border-border" style={{ top: "var(--navbar-height, 56px)" }}>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, genre, developer..."
            aria-label="Search games"
            className="w-full h-11 pl-10 pr-4 text-sm rounded-xl border border-border bg-surface-2 text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
            autoFocus={false}
          />
          {query !== debouncedQuery && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {browseTab === "games" && (
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium block">
            Platform
          </label>
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <FilterChips
              options={PLATFORM_FILTER_OPTIONS.map((option) => option.value)}
              selected={platform}
              onChange={(value) => {
                setPlatform(value);
                setPage(1);
              }}
              labelFn={(value) => PLATFORM_FILTER_OPTIONS.find((option) => option.value === value)?.label ?? value}
              iconFn={(value) => platformFilterIcon(value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium block">
            Price
          </label>
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <FilterChips
              options={MONETIZATION_OPTIONS as unknown as string[]}
              selected={monetization}
              onChange={(value) => {
                setMonetization(value as MonetizationType | "All");
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
              Genre
            </label>
            <select
              value={genre}
              onChange={(e) => {
                setGenre(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 text-sm rounded-xl border border-border bg-surface-2 text-foreground focus:outline-none focus:border-accent/50 transition-colors"
            >
              <option value="">All Genres</option>
              {allGenres.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
              Year
            </label>
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 text-sm rounded-xl border border-border bg-surface-2 text-foreground focus:outline-none focus:border-accent/50 transition-colors"
            >
              <option value="">All Years</option>
              {allYears.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 ml-auto">
            <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
              Sort
            </label>
            <SortDropdown
              options={[
                { label: "Relevance", value: "relevance" as SortOption },
                { label: "Newest Released", value: "newest" as SortOption },
                { label: "Upcoming", value: "upcoming" as SortOption },
                { label: "Recently Added", value: "recently-added" as SortOption },
                { label: "Top Rated", value: "top-rated" as SortOption },
                { label: "Trending", value: "trending" as SortOption },
              ]}
              selected={sort}
              onChange={(value) => {
                setSort(value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>
      )}

      {browseTab === "games" && (
      <div>
        <AnimatePresence mode="wait">
          {isInitialLoad ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {debouncedQuery && (
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-tertiary">
                    Searching for &ldquo;{debouncedQuery}&rdquo;...
                  </p>
                </div>
              )}
              <GameGridSkeleton count={8} />
            </motion.div>
          ) : games.length > 0 ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={isFetching ? "opacity-60 pointer-events-none transition-opacity relative" : "transition-opacity relative"}
            >
              <div className="flex items-center gap-2 mb-4">
                <p className="text-xs text-tertiary">
                  Showing {(page - 1) * (data?.pageSize ?? 25) + 1}–{Math.min(page * (data?.pageSize ?? 25), totalCount)} of {totalCount} game{totalCount !== 1 ? "s" : ""}
                </p>
                {isFetching && (
                  <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <GameGrid games={games} columns={5} />

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-8">
                  <button
                    onClick={() => { setPage((currentPage) => Math.max(1, currentPage - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    disabled={page <= 1}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-secondary hover:text-foreground hover:border-accent/50 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {(() => {
                      const pages: (number | "...")[] = [];
                      if (totalPages <= 7) {
                        for (let i = 1; i <= totalPages; i += 1) pages.push(i);
                      } else {
                        pages.push(1);
                        if (page > 3) pages.push("...");
                        for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i += 1) pages.push(i);
                        if (page < totalPages - 2) pages.push("...");
                        pages.push(totalPages);
                      }
                      return pages.map((candidate, index) =>
                        candidate === "..." ? (
                          <span key={`ellipsis-${index}`} className="px-2 text-tertiary text-sm">…</span>
                        ) : (
                          <button
                            key={candidate}
                            onClick={() => { setPage(candidate); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                            className={`w-9 h-9 text-sm font-medium rounded-lg transition-colors ${
                              candidate === page
                                ? "bg-accent text-white"
                                : "text-secondary hover:text-foreground hover:bg-surface-2"
                            }`}
                          >
                            {candidate}
                          </button>
                        )
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => { setPage((currentPage) => Math.min(totalPages, currentPage + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    disabled={!hasMore}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-secondary hover:text-foreground hover:border-accent/50 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  >
                    Next
                  </button>
                </div>
              )}
            </motion.div>
          ) : !isLoading ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center py-16 space-y-4"
            >
              <div className="text-5xl">🔍</div>
              <p className="text-foreground font-semibold text-lg">No games found</p>
              <p className="text-sm text-secondary max-w-md mx-auto">
                {debouncedQuery
                  ? `No results for "${debouncedQuery}". The game may not be in our database yet — try a different spelling or search for a popular title.`
                  : "Start typing to search for games, or try adjusting your filters."}
              </p>
              {(platform !== "All" || genre || year || monetization !== "All") && (
                <button
                  onClick={resetFilters}
                  className={RESET_FILTERS_BUTTON_CLASS}
                >
                  <RotateCcw className="w-4 h-4" />
                  {RESET_FILTERS_LABEL}
                </button>
              )}
              <div className="pt-4 text-xs text-tertiary">
                <p>Tip: Search for popular games like &ldquo;Counter-Strike 2&rdquo;, &ldquo;Elden Ring&rdquo;, or &ldquo;Valorant&rdquo;</p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      )}

      {browseTab === "deals" && (
        <div>
          <div className="space-y-4 mb-6">
            {availableStores.length > 1 && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
                  Store
                </label>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
                  <button
                    onClick={() => setGxStore("All")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                      gxStore === "All"
                        ? "bg-pixel-green/20 text-pixel-green border border-pixel-green/30"
                        : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                    )}
                  >
                    All Stores
                  </button>
                  {availableStores.map((store) => (
                    <button
                      key={store}
                      onClick={() => setGxStore(store)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                        gxStore === store
                          ? "bg-pixel-green/20 text-pixel-green border border-pixel-green/30"
                          : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                      )}
                    >
                      {store}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {availableDealsGenres.length > 1 && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
                  Genre
                </label>
                <div className="relative group/scroll">
                  <button
                    onClick={() => scrollContainer(dealsGenreRef, "left")}
                    className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center bg-background/90 backdrop-blur-sm border border-border rounded-full shadow-lg opacity-0 group-hover/scroll:opacity-100 transition-opacity hover:bg-surface-2"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="w-4 h-4 text-foreground" />
                  </button>

                  <div
                    ref={dealsGenreRef}
                    className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:scroll-smooth"
                  >
                    <button
                      onClick={() => setGxGenre("All")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                        gxGenre === "All"
                          ? "bg-accent/20 text-accent border border-accent/30"
                          : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                      )}
                    >
                      All Genres
                    </button>
                    {availableDealsGenres.map((candidate) => (
                      <button
                        key={candidate}
                        onClick={() => setGxGenre(candidate)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                          gxGenre === candidate
                            ? "bg-accent/20 text-accent border border-accent/30"
                            : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                        )}
                      >
                        {candidate}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => scrollContainer(dealsGenreRef, "right")}
                    className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center bg-background/90 backdrop-blur-sm border border-border rounded-full shadow-lg opacity-0 group-hover/scroll:opacity-100 transition-opacity hover:bg-surface-2"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-4 h-4 text-foreground" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-tertiary">
                {dealsLoading ? "Loading deals…" : `${filteredDeals.length} deal${filteredDeals.length !== 1 ? "s" : ""} found`}
              </span>
              <select
                value={dealsSortMode}
                onChange={(e) => setDealsSortMode(e.target.value as DealsSortMode)}
                className="text-xs bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-secondary focus:outline-none focus:border-accent/40"
              >
                {DEALS_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {dealsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-border bg-surface overflow-hidden">
                  <div className="aspect-[3/4] bg-surface-2 animate-pulse" />
                  <div className="p-3.5 space-y-2">
                    <div className="h-4 w-3/4 bg-surface-2 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-surface-2 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredDeals.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredDeals.map((deal, index) => (
                <motion.div
                  key={deal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.5), duration: 0.4 }}
                >
                  <GXDealCard deal={deal} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <Tag className="w-12 h-12 text-tertiary mx-auto mb-3" />
              <p className="text-secondary">No deals match your filters.</p>
              <button
                onClick={resetDealsFilters}
                className={`${RESET_FILTERS_BUTTON_CLASS} mt-3`}
              >
                <RotateCcw className="w-4 h-4" />
                {RESET_FILTERS_LABEL}
              </button>
            </div>
          )}
          <p className="text-center text-[10px] text-tertiary pt-6">
            Deal data powered by <a href="https://gxcorner.games" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">GX Corner</a>
          </p>
        </div>
      )}

      {browseTab === "free" && (
        <div>
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 mb-4">
            <button
              onClick={() => handleFreeSubTabChange("free")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                freeSubTab === "free"
                  ? "bg-pixel-green/20 text-pixel-green border border-pixel-green/30 shadow-sm"
                  : "bg-surface border border-border text-secondary hover:text-foreground hover:border-border-hover"
              )}
            >
              <Gift className="w-4 h-4" />
              Free Games
            </button>
            <button
              onClick={() => handleFreeSubTabChange("subscriptions")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                freeSubTab === "subscriptions"
                  ? "bg-accent/20 text-accent border border-accent/30 shadow-sm"
                  : "bg-surface border border-border text-secondary hover:text-foreground hover:border-border-hover"
              )}
            >
              <Gamepad2 className="w-4 h-4" />
              Game Pass & PS Plus
            </button>
          </div>

          <div className="space-y-3 mb-6">
            <AnimatePresence mode="wait">
              {freeSubTab === "subscriptions" && availableServices.length > 1 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-2"
                >
                  <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
                    Service
                  </label>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <button
                      onClick={() => setGxService("All")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                        gxService === "All"
                          ? "bg-accent/20 text-accent border border-accent/30"
                          : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                      )}
                    >
                      All Services
                    </button>
                    {availableServices.map((service) => (
                      <button
                        key={service}
                        onClick={() => setGxService(service)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                          gxService === service
                            ? "bg-accent/20 text-accent border border-accent/30"
                            : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                        )}
                      >
                        {service}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {availableFreeGenres.length > 1 && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
                  Genre
                </label>
                <div className="relative group/scroll">
                  <button
                    onClick={() => scrollContainer(freeGenreRef, "left")}
                    className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center bg-background/90 backdrop-blur-sm border border-border rounded-full shadow-lg opacity-0 group-hover/scroll:opacity-100 transition-opacity hover:bg-surface-2"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="w-4 h-4 text-foreground" />
                  </button>

                  <div
                    ref={freeGenreRef}
                    className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:scroll-smooth"
                  >
                    <button
                      onClick={() => setGxGenre("All")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                        gxGenre === "All"
                          ? "bg-accent/20 text-accent border border-accent/30"
                          : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                      )}
                    >
                      All Genres
                    </button>
                    {availableFreeGenres.map((candidate) => (
                      <button
                        key={candidate}
                        onClick={() => setGxGenre(candidate)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                          gxGenre === candidate
                            ? "bg-accent/20 text-accent border border-accent/30"
                            : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                        )}
                      >
                        {candidate}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => scrollContainer(freeGenreRef, "right")}
                    className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center bg-background/90 backdrop-blur-sm border border-border rounded-full shadow-lg opacity-0 group-hover/scroll:opacity-100 transition-opacity hover:bg-surface-2"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-4 h-4 text-foreground" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-tertiary">
                {(freeSubTab === "free" ? freeLoading : topGamesLoading)
                  ? "Loading games…"
                  : `${freeSubTab === "free" ? filteredFreeGames.length : filteredSubscriptionGames.length} game${(freeSubTab === "free" ? filteredFreeGames.length : filteredSubscriptionGames.length) !== 1 ? "s" : ""} found`}
              </span>
            </div>
          </div>

          {freeSubTab === "free" && (
            <>
              {freeLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <div key={index} className="rounded-2xl border border-border bg-surface overflow-hidden">
                      <div className="aspect-[3/4] bg-surface-2 animate-pulse" />
                      <div className="p-3.5 space-y-2">
                        <div className="h-4 w-3/4 bg-surface-2 rounded animate-pulse" />
                        <div className="h-3 w-1/2 bg-surface-2 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredFreeGames.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredFreeGames.map((game, index) => (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.03, 0.5), duration: 0.4 }}
                    >
                      <div className="flex flex-col group rounded-2xl border border-border bg-surface overflow-hidden card-shimmer hover:border-pixel-green/30 hover:shadow-lg transition-all duration-300">
                        <Link href={`/game/${slugify(game.title)}`} className="block">
                          <div className="relative aspect-[3/4] overflow-hidden">
                            {game.cover ? (
                              <Image
                                src={game.cover}
                                alt={game.title}
                                fill
                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                className="object-cover transition-transform duration-700 group-hover:scale-110"
                              />
                            ) : (
                              <div className="w-full h-full bg-surface-2 flex items-center justify-center">
                                <Gamepad2 className="w-8 h-8 text-tertiary" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute top-2.5 left-2.5">
                              <span className="text-[10px] font-bold text-white bg-pixel-green/80 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10">
                                FREE
                              </span>
                            </div>
                          </div>
                        </Link>
                        <div className="p-3 flex-1 flex flex-col gap-1.5">
                          <Link href={`/game/${slugify(game.title)}`}>
                            <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-pixel-green transition-colors">
                              {game.title}
                            </h3>
                          </Link>
                          <span className="text-[10px] text-tertiary font-medium truncate min-h-[16px]">
                            {game.genres.slice(0, 2).join(" · ") || "\u00A0"}
                          </span>
                          {game.url && (
                            <a
                              href={game.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "mt-auto flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200",
                                "bg-pixel-green/15 text-pixel-green border border-pixel-green/20",
                                "hover:bg-pixel-green hover:text-black hover:border-pixel-green"
                              )}
                            >
                              <ExternalLink className="w-3 h-3" />
                              Play Free
                            </a>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center">
                  <Gift className="w-12 h-12 text-tertiary mx-auto mb-3" />
                  <p className="text-secondary">No free games match your filters.</p>
                  <button
                    onClick={resetFreeFilters}
                    className={`${RESET_FILTERS_BUTTON_CLASS} mt-3`}
                  >
                    <RotateCcw className="w-4 h-4" />
                    {RESET_FILTERS_LABEL}
                  </button>
                </div>
              )}
            </>
          )}

          {freeSubTab === "subscriptions" && (
            <>
              {topGamesLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <div key={index} className="rounded-2xl border border-border bg-surface overflow-hidden">
                      <div className="aspect-[3/4] bg-surface-2 animate-pulse" />
                      <div className="p-3.5 space-y-2">
                        <div className="h-4 w-3/4 bg-surface-2 rounded animate-pulse" />
                        <div className="h-3 w-1/2 bg-surface-2 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredSubscriptionGames.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredSubscriptionGames.map((game, index) => (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.03, 0.5), duration: 0.4 }}
                    >
                      <div className="flex flex-col group rounded-2xl border border-border bg-surface overflow-hidden card-shimmer hover:border-accent/30 hover:shadow-lg transition-all duration-300">
                        <Link href={`/game/${slugify(game.title)}`} className="block">
                          <div className="relative aspect-[3/4] overflow-hidden">
                            {game.cover ? (
                              <Image
                                src={game.cover}
                                alt={game.title}
                                fill
                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                className="object-cover transition-transform duration-700 group-hover:scale-110"
                              />
                            ) : (
                              <div className="w-full h-full bg-surface-2 flex items-center justify-center">
                                <Gamepad2 className="w-8 h-8 text-tertiary" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            {game.serviceName && (
                              <div className="absolute top-2.5 left-2.5">
                                <span
                                  className="text-[10px] font-bold text-white backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10"
                                  style={{ backgroundColor: game.serviceColor ? `${game.serviceColor}CC` : "rgba(139,92,246,0.8)" }}
                                >
                                  {game.serviceName}
                                </span>
                              </div>
                            )}
                            {game.serviceTag && (
                              <div className="absolute top-2.5 right-2.5">
                                <span className="text-[10px] font-bold text-white bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10">
                                  {game.serviceTag}
                                </span>
                              </div>
                            )}
                          </div>
                        </Link>
                        <div className="p-3 flex-1 flex flex-col gap-1.5">
                          <Link href={`/game/${slugify(game.title)}`}>
                            <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-accent transition-colors">
                              {game.title}
                            </h3>
                          </Link>
                          <span className="text-[10px] text-tertiary font-medium truncate min-h-[16px]">
                            {game.genres.slice(0, 2).join(" · ") || "\u00A0"}
                          </span>
                          {game.url && (
                            <a
                              href={game.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "mt-auto flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200",
                                "bg-accent/15 text-accent border border-accent/20",
                                "hover:bg-accent hover:text-white hover:border-accent"
                              )}
                            >
                              <ExternalLink className="w-3 h-3" />
                              {game.serviceName ? `View on ${game.serviceName}` : "View"}
                            </a>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center">
                  <Gamepad2 className="w-12 h-12 text-tertiary mx-auto mb-3" />
                  <p className="text-secondary">No subscription games match your filters.</p>
                  <button
                    onClick={resetSubscriptionFilters}
                    className={`${RESET_FILTERS_BUTTON_CLASS} mt-3`}
                  >
                    <RotateCcw className="w-4 h-4" />
                    {RESET_FILTERS_LABEL}
                  </button>
                </div>
              )}
            </>
          )}

          <p className="text-center text-[10px] text-tertiary pt-6">
            Game data powered by <a href="https://gxcorner.games" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">GX Corner</a>
          </p>
        </div>
      )}
    </div>
  );
}
