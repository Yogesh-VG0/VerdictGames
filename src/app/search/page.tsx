"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { searchGames } from "@/lib/api";
import type { Game, SearchFilters, SortOption, MonetizationType, Platform } from "@/lib/types";
import { PLATFORM_FILTER_OPTIONS, platformFilterIcon } from "@/components/ui/PlatformIcon";

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
import { Flame, Trophy, Sparkles, Calendar, Clock, Search as SearchIcon } from "lucide-react";

/* Platform icons imported from shared PlatformIcon component */

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

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
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Accumulated results across pages for infinite scroll
  const accumulatedRef = useRef<Game[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Track filter fingerprint to reset accumulation when filters change
  const filterKey = `${debouncedQuery}|${platform}|${genre}|${year}|${monetization}|${sort}`;
  const prevFilterKeyRef = useRef(filterKey);

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

  const { data, isLoading } = useQuery({
    queryKey: ["search", filters],
    queryFn: () => searchGames(filters),
  });

  // When filters change, reset accumulated results
  useEffect(() => {
    if (prevFilterKeyRef.current !== filterKey) {
      accumulatedRef.current = [];
      setAllGames([]);
      prevFilterKeyRef.current = filterKey;
    }
  }, [filterKey]);

  // When data arrives, accumulate or replace based on page
  useEffect(() => {
    if (!data) return;

    if (page === 1) {
      // Fresh search — replace everything
      accumulatedRef.current = data.items;
    } else {
      // Append new page — dedup by ID
      const existingIds = new Set(accumulatedRef.current.map((g) => g.id));
      const newItems = data.items.filter((g) => !existingIds.has(g.id));
      accumulatedRef.current = [...accumulatedRef.current, ...newItems];
    }

    setAllGames([...accumulatedRef.current]);
    setTotalCount(data.total);
    setHasMore(data.hasMore);
    setLoadingMore(false);
  }, [data, page]);

  const handleLoadMore = useCallback(() => {
    setLoadingMore(true);
    setPage((p) => p + 1);
  }, []);

  // Reset filters handler
  const resetFilters = useCallback(() => {
    setPlatform("All");
    setGenre("");
    setYear("");
    setMonetization("All");
    setSort("relevance");
    setPage(1);
  }, []);

  // Sync URL on filter change
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (platform !== "All") params.set("platform", platform);
    if (genre) params.set("genre", genre);
    if (year) params.set("year", year);
    if (monetization !== "All") params.set("monetization", monetization);
    if (sort !== "relevance") params.set("sort", sort);
    router.replace(`/search?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, platform, genre, year, monetization, sort]);

  const isInitialLoad = isLoading && page === 1;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6 overflow-x-hidden">
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
           sort === "recently-added" ? <><Clock className="w-6 h-6 text-blue-500" /><GradientText text="Recently Added" gradient="linear-gradient(90deg, #3b82f6, #06b6d4, #3b82f6)" /></> :
           <><SearchIcon className="w-6 h-6 text-accent" /><GradientText text="Search Games" gradient="linear-gradient(90deg, #6366f1 0%, #8b5cf6 25%, #a78bfa 50%, #8b5cf6 75%, #6366f1 100%)" /></>}
        </h1>
        <p className="text-sm text-secondary">
          {sort === "trending" ? "Games gaining momentum right now based on player activity." :
           sort === "top-rated" ? "Highest Verdict scores across all platforms." :
           sort === "newest" ? "The latest released games, sorted by release date." :
           sort === "upcoming" ? "Unreleased games arriving soonest." :
           sort === "recently-added" ? "The newest additions to our database." :
           "Discover and filter games across all platforms."}
        </p>
      </motion.div>

      {/* Sticky search bar */}
      <div className="sticky top-12 md:top-20 z-40 bg-background/80 backdrop-blur-xl py-3 -mx-4 px-4 border-b border-border">
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

      {/* Filters */}
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
              className="h-8 px-2 text-xs rounded-xl border border-border bg-surface-2 text-foreground focus:outline-none focus:border-accent/50"
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
              className="h-8 px-2 text-xs rounded-xl border border-border bg-surface-2 text-foreground focus:outline-none focus:border-accent/50"
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

      {/* Results */}
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
          ) : allGames.length > 0 ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-xs text-tertiary mb-4">
                Showing {allGames.length} of {totalCount} game{totalCount !== 1 ? "s" : ""}
              </p>
              <GameGrid games={allGames} />

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center pt-8">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-6 py-2.5 text-sm font-medium text-accent border border-accent rounded-full hover:bg-accent/10 transition-colors disabled:opacity-60 flex items-center gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load more"
                    )}
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
