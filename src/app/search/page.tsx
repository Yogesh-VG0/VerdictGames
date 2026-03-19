"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { searchGames } from "@/lib/api";
import type { Game, SearchFilters, SortOption, MonetizationType, Platform } from "@/lib/types";
import { platformShort } from "@/lib/utils";

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
import { GameGridSkeleton } from "@/components/ui/Skeleton";

/* ── Platform icon SVGs ── */
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  PC: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>
  ),
  "PlayStation 5": (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8.985 2.596v17.548l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.181.76.814.76 1.505v5.876c2.441 1.193 4.362-.002 4.362-3.153 0-3.237-1.126-4.675-5.462-5.867-1.355-.41-3.118-.856-4.369-1.462zM19.51 16.39c-1.461-.83-3.21-1.242-5.034-1.242-.456 0-2.382.111-3.465.536l-.004.002-.002.001v2.86l3.471-1.272c.385-.141.77-.057.77.297 0 .357-.385.609-.77.75l-3.471 1.271v2.674l5.201-1.862c.728-.374 2.278-1.041 2.278-2.332 0-.762-.354-1.267-1.037-1.683h.063zm-14.888.992c1.615-.65 3.946-1.088 5.25-.644.543.186 1.072.473 1.504.882l-.002-2.627c-.084-.065-1.27-.94-3.504-.868-1.48.048-3.09.461-4.36 1.054l-.084.04c-.655.321-1.426.84-1.426 1.73 0 .88.649 1.413 1.104 1.64l4.253 1.917v-2.674l-2.98-1.093c-.385-.141-.555-.504-.171-.644.214-.078.269-.083.416-.113l-.001-.6z"/></svg>
  ),
  "Xbox Series X|S": (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M4.102 21.033A11.947 11.947 0 0 0 12 24a11.96 11.96 0 0 0 7.902-2.967c1.877-2.575-.96-7.266-5.728-11.165a34.7 34.7 0 0 0-2.166-1.652 34.7 34.7 0 0 0-2.174 1.652C5.063 13.767 2.225 18.458 4.102 21.033zM23.52 8.27a11.98 11.98 0 0 0-4.313-5.36l-.016.008c-.13.073-.263.156-.396.248.476.394.963.83 1.455 1.313 3.07 3.016 4.874 6.338 4.043 8.432a11.89 11.89 0 0 0 .737-3.262c.042-.381.062-.765.062-1.15a12.12 12.12 0 0 0-.572-3.229zm-19.49 4.66c-.83-2.093.974-5.416 4.043-8.432A19.68 19.68 0 0 1 9.53 3.166c-.133-.092-.266-.175-.396-.248L9.118 2.91A11.98 11.98 0 0 0 4.805 8.27 12.12 12.12 0 0 0 4.233 11.5c0 .385.02.768.062 1.15.137.866.367 1.71.735 3.28zm7.975-10.52C13.844.993 15.14.5 15.14.5A11.69 11.69 0 0 0 12 0C10.62 0 9.3.303 8.096.858c0 0 1.514.288 3.91 1.552z"/></svg>
  ),
  "Nintendo Switch": (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M14.176 24h3.674c3.376 0 6.15-2.774 6.15-6.15V6.15C24 2.775 21.226 0 17.85 0H14.176c-.473 0-.857.384-.857.857v22.286c0 .473.384.857.857.857zM18 7.5a1.5 1.5 0 1 1-.001 3.001A1.5 1.5 0 0 1 18 7.5zM6.15 0C2.774 0 0 2.774 0 6.15v11.7C0 21.226 2.774 24 6.15 24h3.674c.473 0 .857-.384.857-.857V.857C10.68.384 10.297 0 9.824 0H6.15zM6 16.5a1.5 1.5 0 1 1 .001-3.001A1.5 1.5 0 0 1 6 16.5z"/></svg>
  ),
  Android: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.523 15.341a1.047 1.047 0 0 0 0-2.094 1.047 1.047 0 0 0 0 2.094zm-11.046 0a1.047 1.047 0 0 0 0-2.094 1.047 1.047 0 0 0 0 2.094zm11.405-6.02 1.997-3.46a.416.416 0 0 0-.152-.567.416.416 0 0 0-.568.152L17.13 8.95a12.346 12.346 0 0 0-5.13-1.096A12.346 12.346 0 0 0 6.87 8.95L4.84 5.446a.416.416 0 0 0-.567-.152.416.416 0 0 0-.152.567l1.997 3.46C2.688 11.186.343 14.653 0 18.7h24c-.344-4.047-2.688-7.514-6.118-9.38z"/></svg>
  ),
};

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
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Search header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-1"
      >
        <h1 className="text-2xl font-bold text-foreground">Search Games</h1>
        <p className="text-sm text-secondary">
          Discover and filter games across all platforms.
        </p>
      </motion.div>

      {/* Sticky search bar */}
      <div className="sticky top-12 md:top-20 z-40 bg-background/80 backdrop-blur-xl py-3 -mx-4 px-4 border-b border-white/[0.06]">
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
            className="w-full h-11 pl-10 pr-4 text-sm rounded-xl border border-white/10 bg-white/5 text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
            autoFocus
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
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
              Platform
            </label>
            <FilterChips
              options={["All", "PC", "PlayStation 5", "Xbox Series X|S", "Nintendo Switch", "Android"] as (Platform | "All")[]}
              selected={platform}
              onChange={(v) => {
                setPlatform(v);
                setPage(1);
              }}
              labelFn={(v) => v === "All" ? "All" : platformShort(v as Platform)}
              iconFn={(v) => v === "All" ? null : (PLATFORM_ICONS[v] ?? null)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Genre select */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
              Genre
            </label>
            <select
              value={genre}
              onChange={(e) => {
                setGenre(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2 text-xs rounded-xl border border-white/10 bg-white/5 text-foreground focus:outline-none focus:border-accent/50"
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
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
              Year
            </label>
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2 text-xs rounded-xl border border-white/10 bg-white/5 text-foreground focus:outline-none focus:border-accent/50"
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
                { label: "Newest", value: "newest" as SortOption },
                { label: "Top Rated", value: "top-rated" as SortOption },
                { label: "Trending", value: "trending" as SortOption },
              ]}
              selected={sort}
              onChange={(v) => setSort(v)}
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
                    {debouncedQuery.length >= 2 && (
                      <span className="ml-1 text-accent">
                        (may auto-discover new games)
                      </span>
                    )}
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
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          <GameGridSkeleton count={8} />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
