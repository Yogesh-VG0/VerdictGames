"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { searchGames, getGXDeals, getGXFreeToPlay } from "@/lib/api";
import type { Game, SearchFilters, SortOption, MonetizationType, Platform, GXDeal, GXFreeGame } from "@/lib/types";
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
import { Flame, Trophy, Sparkles, Calendar, Clock, Search as SearchIcon, Tag, Gift, Gamepad2, ExternalLink } from "lucide-react";
import { slugify } from "@/lib/utils/slugify";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

type BrowseTab = "games" | "deals" | "free";

const MONETIZATION_OPTIONS = ["All", "Free", "Paid"] as const;

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
          ) : dealsData && dealsData.length > 0 ? (
            <>
              <p className="text-xs text-tertiary mb-4">{dealsData.length} deal{dealsData.length !== 1 ? "s" : ""} available</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                {dealsData.map((deal, i) => (
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
            </>
          ) : (
            <div className="py-16 text-center">
              <Tag className="w-12 h-12 text-tertiary mx-auto mb-3" />
              <p className="text-secondary">No deals available right now.</p>
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
          ) : freeData && freeData.length > 0 ? (
            <>
              <p className="text-xs text-tertiary mb-4">{freeData.length} free game{freeData.length !== 1 ? "s" : ""}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                {freeData.map((game, i) => (
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
                            <div className="w-full h-full bg-gradient-to-br from-pixel-green/20 via-surface-2 to-pixel-cyan/10 flex flex-col items-center justify-center gap-2 p-3">
                              <Gamepad2 className="w-8 h-8 text-pixel-green/40" />
                              <span className="text-tertiary text-[10px] font-semibold text-center line-clamp-2">{game.title}</span>
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
            </>
          ) : (
            <div className="py-16 text-center">
              <Gift className="w-12 h-12 text-tertiary mx-auto mb-3" />
              <p className="text-secondary">No free games available right now.</p>
            </div>
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
