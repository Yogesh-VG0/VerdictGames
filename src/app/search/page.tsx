"use client";

import { useState, useEffect, useCallback, useMemo, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { searchGames, getGXDeals, getGXFreeToPlay, getGXTopGames } from "@/lib/api";
import type { Game, SearchFilters, SortOption, MonetizationType, Platform, GXDeal, GXFreeGame, GXTopGame } from "@/lib/types";
import { PLATFORM_FILTER_OPTIONS, platformFilterIcon } from "@/components/ui/PlatformIcon";
import GXDealCard from "@/components/GXDealCard";

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
import GameGrid from "@/components/GameGrid";
import FilterChips from "@/components/ui/FilterChips";
import SortDropdown from "@/components/ui/SortDropdown";
import GradientText from "@/components/ui/GradientText";
import { GameGridSkeleton } from "@/components/ui/Skeleton";
import { Flame, Trophy, Sparkles, Calendar, Clock, Search as SearchIcon, Tag, Gift, Gamepad2, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { slugify } from "@/lib/utils/slugify";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

type BrowseTab = "games" | "deals" | "free";
type FreeSubTab = "free" | "subscriptions";
type DealsSortMode = "discount" | "price-low" | "price-high" | "name";

const DEALS_SORT_OPTIONS: { value: DealsSortMode; label: string }[] = [
  { value: "discount", label: "Biggest Discount" },
  { value: "price-low", label: "Price: Low → High" },
  { value: "price-high", label: "Price: High → Low" },
  { value: "name", label: "A → Z" },
];

const MONETIZATION_OPTIONS = ["All", "Free", "Paid"] as const;

// Common genres found in GX deals/free-to-play data
const GX_GENRE_OPTIONS = [
  "All",
  "Action",
  "Adventure", 
  "RPG",
  "Shooter",
  "Strategy",
  "Puzzle",
  "Horror",
  "Platformer",
  "Racing",
  "Simulation",
  "Sports",
  "Fighting",
] as const;

// Platform options for GX filtering
const GX_PLATFORM_OPTIONS = [
  { value: "All", label: "All Platforms" },
  { value: "Windows", label: "PC" },
  { value: "Playstation", label: "PlayStation" },
  { value: "Xbox", label: "Xbox" },
  { value: "Switch", label: "Switch" },
  { value: "Mac", label: "Mac" },
] as const;

/* Platform icons imported from shared PlatformIcon component */

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [browseTab, setBrowseTab] = useState<BrowseTab>(
    (searchParams.get("tab") as BrowseTab) || "games"
  );
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [platform, setPlatform] = useState<Platform | "All">(
    (searchParams.get("platform") as Platform) ?? "All"
  );
  const [genre, setGenre] = useState(searchParams.get("genre") ?? "");
  const [year, setYear] = useState(searchParams.get("year") ?? "");
  const [monetization, setMonetization] = useState<MonetizationType | "All">(
    (searchParams.get("monetization") as MonetizationType) ?? "All"
  );
  const [sort, setSort] = useState<SortOption>(
    (searchParams.get("sort") as SortOption) ?? "relevance"
  );
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get("page") ?? "1", 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  
  // GX tab filters (Deals / Free to Play)
  const [gxGenre, setGxGenre] = useState("All");
  const [gxPlatform, setGxPlatform] = useState("All");
  const [gxStore, setGxStore] = useState("All");
  const [dealsSortMode, setDealsSortMode] = useState<DealsSortMode>("discount");
  const [freeSubTab, setFreeSubTab] = useState<FreeSubTab>("free");
  const [gxService, setGxService] = useState("All");

  // Scroll refs for genre filter containers
  const dealsGenreRef = useRef<HTMLDivElement>(null);
  const freeGenreRef = useRef<HTMLDivElement>(null);
  const serviceRef = useRef<HTMLDivElement>(null);

  const scrollContainer = (ref: React.RefObject<HTMLDivElement | null>, direction: "left" | "right") => {
    if (!ref.current) return;
    const scrollAmount = 200;
    ref.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // Debounce the query input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const filters: SearchFilters = {
    query: debouncedQuery || undefined,
    platform,
    genre: genre || undefined,
    year: year || undefined,
    monetization,
    sort,
    page,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["search", filters],
    queryFn: () => searchGames(filters),
    placeholderData: (prev) => prev,
  });

  const games = data?.items ?? [];
  const totalCount = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;
  const totalPages = Math.ceil(totalCount / (data?.pageSize ?? 25));

  // Reset filters handler
  const resetFilters = useCallback(() => {
    setPlatform("All");
    setGenre("");
    setYear("");
    setMonetization("All");
    setSort("relevance");
    setPage(1);
  }, []);

  // Fetch deals and free-to-play data for browse tabs
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

  // Extract unique stores from deals data
  const availableStores = useMemo(() => {
    if (!dealsData) return [];
    const set = new Set<string>();
    dealsData.forEach((d) => { if (d.storeName) set.add(d.storeName); });
    return Array.from(set).sort();
  }, [dealsData]);

  // Extract unique services from top games data
  const availableServices = useMemo(() => {
    if (!topGamesData) return [];
    const set = new Set<string>();
    topGamesData.forEach((g) => { if (g.serviceName) set.add(g.serviceName); });
    return Array.from(set).sort();
  }, [topGamesData]);

  // Extract dynamic genres from current data
  const availableDealsGenres = useMemo(() => {
    if (!dealsData) return [];
    const set = new Set<string>();
    dealsData.forEach((d) => d.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [dealsData]);

  const availableFreeGenres = useMemo(() => {
    const data = freeSubTab === "free" ? freeData : topGamesData;
    if (!data) return [];
    const set = new Set<string>();
    data.forEach((g) => g.genres.forEach((ge) => set.add(ge)));
    return Array.from(set).sort();
  }, [freeData, topGamesData, freeSubTab]);
  
  // Filter deals data based on selected filters
  const filteredDeals = useMemo(() => {
    if (!dealsData) return [];
    let result = dealsData.filter((deal) => {
      // Store filter
      if (gxStore !== "All" && deal.storeName !== gxStore) return false;
      // Genre filter
      if (gxGenre !== "All") {
        const hasGenre = deal.genres.some((g) => 
          g.toLowerCase().includes(gxGenre.toLowerCase())
        );
        if (!hasGenre) return false;
      }
      // Platform filter
      if (gxPlatform !== "All") {
        const hasPlatform = deal.platforms.some((p) => 
          p.toLowerCase().includes(gxPlatform.toLowerCase())
        );
        if (!hasPlatform) return false;
      }
      return true;
    });

    // Sort
    switch (dealsSortMode) {
      case "discount":
        result.sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0));
        break;
      case "price-low":
        result.sort((a, b) => (a.price ?? 999) - (b.price ?? 999));
        break;
      case "price-high":
        result.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        break;
      case "name":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return result;
  }, [dealsData, gxGenre, gxPlatform, gxStore, dealsSortMode]);
  
  // Filter free-to-play data based on selected filters
  const filteredFreeGames = useMemo(() => {
    if (!freeData) return [];
    return freeData.filter((game) => {
      // Genre filter
      if (gxGenre !== "All") {
        const hasGenre = game.genres.some((g) => 
          g.toLowerCase().includes(gxGenre.toLowerCase())
        );
        if (!hasGenre) return false;
      }
      // Platform filter
      if (gxPlatform !== "All") {
        const hasPlatform = game.platforms.some((p) => 
          p.toLowerCase().includes(gxPlatform.toLowerCase())
        );
        if (!hasPlatform) return false;
      }
      return true;
    });
  }, [freeData, gxGenre, gxPlatform]);

  // Filter subscription games
  const filteredSubscriptionGames = useMemo(() => {
    if (!topGamesData) return [];
    return topGamesData.filter((game) => {
      // Service filter
      if (gxService !== "All" && game.serviceName !== gxService) return false;
      // Genre filter
      if (gxGenre !== "All") {
        const hasGenre = game.genres.some((g) => 
          g.toLowerCase().includes(gxGenre.toLowerCase())
        );
        if (!hasGenre) return false;
      }
      // Platform filter
      if (gxPlatform !== "All") {
        const hasPlatform = game.platforms.some((p) => 
          p.toLowerCase().includes(gxPlatform.toLowerCase())
        );
        if (!hasPlatform) return false;
      }
      return true;
    });
  }, [topGamesData, gxGenre, gxPlatform, gxService]);

  // Reset GX filters when switching tabs
  const handleFreeSubTabChange = (tab: FreeSubTab) => {
    setFreeSubTab(tab);
    setGxGenre("All");
    setGxPlatform("All");
    setGxService("All");
  };

  // Sync URL on filter/page change
  useEffect(() => {
    const params = new URLSearchParams();
    if (browseTab !== "games") params.set("tab", browseTab);
    if (browseTab === "games") {
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (platform !== "All") params.set("platform", platform);
      if (genre) params.set("genre", genre);
      if (year) params.set("year", year);
      if (monetization !== "All") params.set("monetization", monetization);
      if (sort !== "relevance") params.set("sort", sort);
      if (page > 1) params.set("page", String(page));
    }
    router.replace(`/search?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browseTab, debouncedQuery, platform, genre, year, monetization, sort, page]);

  const isInitialLoad = isLoading && !data;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6 overflow-x-hidden page-enter">
      {/* Search header — contextual based on active sort */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-1"
      >
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          {sort === "trending" ? <><Flame className="w-6 h-6 text-orange-500" /><GradientText text="Trending Games" gradient="linear-gradient(90deg, #f97316, #ef4444, #f97316)" /></> :
           sort === "top-rated" ? <><Trophy className="w-6 h-6 text-yellow-500" /><GradientText text="Top Rated Games" gradient="linear-gradient(90deg, #facc15, #f97316, #22c55e)" /></> :
           sort === "newest" ? <><Sparkles className="w-6 h-6 text-cyan-500" /><GradientText text="New Releases" gradient="linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6)" /></> :
           sort === "upcoming" ? <><Calendar className="w-6 h-6 text-purple-500" /><GradientText text="Upcoming Games" gradient="linear-gradient(90deg, #a855f7, #6366f1, #ec4899)" /></> :
           sort === "recently-added" ? <><Clock className="w-6 h-6 text-blue-500" /><GradientText text="Recently Added to Verdict" gradient="linear-gradient(90deg, #3b82f6, #06b6d4, #3b82f6)" /></> :
           <><SearchIcon className="w-6 h-6 text-accent" /><GradientText text="Search Games" gradient="linear-gradient(90deg, #6366f1 0%, #8b5cf6 25%, #a78bfa 50%, #8b5cf6 75%, #6366f1 100%)" /></>}
        </h1>
        <p className="text-sm text-secondary">
          {sort === "trending" ? "Games gaining momentum right now based on player activity." :
           sort === "top-rated" ? "Highest Verdict scores across all platforms." :
           sort === "newest" ? "The latest released games, sorted by release date." :
           sort === "upcoming" ? "Unreleased games arriving soonest." :
           sort === "recently-added" ? "Latest games added to Verdict — not necessarily new releases." :
           "Discover and filter games across all platforms."}
        </p>
      </motion.div>

      {/* Browse mode tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {([
          { key: "games" as BrowseTab, label: "Games", icon: SearchIcon },
          { key: "deals" as BrowseTab, label: "Deals", icon: Tag },
          { key: "free" as BrowseTab, label: "Free to Play", icon: Gift },
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

      {/* Sticky search bar — only for Games tab */}
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
          {/* Typing indicator */}
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

      {/* Filters — only for Games tab */}
      {browseTab === "games" && (
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium block">
            Platform
          </label>
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <FilterChips
              options={PLATFORM_FILTER_OPTIONS.map((o) => o.value)}
              selected={platform}
              onChange={(v) => {
                setPlatform(v);
                setPage(1);
              }}
              labelFn={(v) => PLATFORM_FILTER_OPTIONS.find((o) => o.value === v)?.label ?? v}
              iconFn={(v) => platformFilterIcon(v)}
            />
          </div>
        </div>

        {/* Monetization filter chips */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium block">
            Price
          </label>
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <FilterChips
              options={MONETIZATION_OPTIONS as unknown as string[]}
              selected={monetization}
              onChange={(v) => {
                setMonetization(v as MonetizationType | "All");
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {/* Genre select */}
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
              {allGenres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Year select */}
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
              {allYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
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
              onChange={(v) => {
                setSort(v);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>
      )}

      {/* Results — Games Tab */}
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-8">
                  <button
                    onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    disabled={page <= 1}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-secondary hover:text-foreground hover:border-accent/50 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {(() => {
                      const pages: (number | "...")[] = [];
                      if (totalPages <= 7) {
                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                      } else {
                        pages.push(1);
                        if (page > 3) pages.push("...");
                        for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                        if (page < totalPages - 2) pages.push("...");
                        pages.push(totalPages);
                      }
                      return pages.map((p, idx) =>
                        p === "..." ? (
                          <span key={`ellipsis-${idx}`} className="px-2 text-tertiary text-sm">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                            className={`w-9 h-9 text-sm font-medium rounded-lg transition-colors ${
                              p === page
                                ? "bg-accent text-white"
                                : "text-secondary hover:text-foreground hover:bg-surface-2"
                            }`}
                          >
                            {p}
                          </button>
                        )
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-accent border border-accent rounded-full hover:bg-accent/10 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear all filters
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

      {/* Deals Tab */}
      {browseTab === "deals" && (
        <div>
          {/* Filters for Deals */}
          <div className="space-y-4 mb-6">
            {/* Store filter chips */}
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
                  {availableStores.map((s) => (
                    <button
                      key={s}
                      onClick={() => setGxStore(s)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                        gxStore === s
                          ? "bg-pixel-green/20 text-pixel-green border border-pixel-green/30"
                          : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Genre filter chips */}
            {availableDealsGenres.length > 1 && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
                  Genre
                </label>
                <div className="relative group/scroll">
                  {/* Left scroll arrow - desktop only */}
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
                    {availableDealsGenres.map((g) => (
                      <button
                        key={g}
                        onClick={() => setGxGenre(g)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                          gxGenre === g
                            ? "bg-accent/20 text-accent border border-accent/30"
                            : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>

                  {/* Right scroll arrow - desktop only */}
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

            {/* Sort + count bar */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-tertiary">
                {dealsLoading ? "Loading deals…" : `${filteredDeals.length} deal${filteredDeals.length !== 1 ? "s" : ""} found`}
              </span>
              <select
                value={dealsSortMode}
                onChange={(e) => setDealsSortMode(e.target.value as DealsSortMode)}
                className="text-xs bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-secondary focus:outline-none focus:border-accent/40"
              >
                {DEALS_SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          {dealsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-border bg-surface overflow-hidden">
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
              {filteredDeals.map((deal, i) => (
                <motion.div
                  key={deal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.5), duration: 0.4 }}
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
                onClick={() => { setGxGenre("All"); setGxStore("All"); }}
                className="mt-3 text-xs text-accent hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
          <p className="text-center text-[10px] text-tertiary pt-6">
            Deal data powered by <a href="https://gxcorner.games" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">GX Corner</a>
          </p>
        </div>
      )}

      {/* Free to Play Tab */}
      {browseTab === "free" && (
        <div>
          {/* Sub-tabs: Free Games vs Subscriptions */}
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

          {/* Filters */}
          <div className="space-y-3 mb-6">
            {/* Service filter (subscriptions sub-tab only) */}
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
                    {availableServices.map((s) => (
                      <button
                        key={s}
                        onClick={() => setGxService(s)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                          gxService === s
                            ? "bg-accent/20 text-accent border border-accent/30"
                            : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Genre filter */}
            {availableFreeGenres.length > 1 && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
                  Genre
                </label>
                <div className="relative group/scroll">
                  {/* Left scroll arrow - desktop only */}
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
                    {availableFreeGenres.map((g) => (
                      <button
                        key={g}
                        onClick={() => setGxGenre(g)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                          gxGenre === g
                            ? "bg-accent/20 text-accent border border-accent/30"
                            : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>

                  {/* Right scroll arrow - desktop only */}
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

            {/* Count */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-tertiary">
                {(freeSubTab === "free" ? freeLoading : topGamesLoading)
                  ? "Loading games…"
                  : `${freeSubTab === "free" ? filteredFreeGames.length : filteredSubscriptionGames.length} game${(freeSubTab === "free" ? filteredFreeGames.length : filteredSubscriptionGames.length) !== 1 ? "s" : ""} found`}
              </span>
            </div>
          </div>
          
          {/* Free Games Grid */}
          {freeSubTab === "free" && (
            <>
              {freeLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-border bg-surface overflow-hidden">
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
                  {filteredFreeGames.map((game, i) => (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.5), duration: 0.4 }}
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
                    onClick={() => setGxGenre("All")}
                    className="mt-3 text-xs text-accent hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </>
          )}

          {/* Subscription Games Grid */}
          {freeSubTab === "subscriptions" && (
            <>
              {topGamesLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-border bg-surface overflow-hidden">
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
                  {filteredSubscriptionGames.map((game, i) => (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.5), duration: 0.4 }}
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
                    onClick={() => { setGxGenre("All"); setGxService("All"); }}
                    className="mt-3 text-xs text-accent hover:underline"
                  >
                    Clear filters
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

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
          <GameGridSkeleton count={8} />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
