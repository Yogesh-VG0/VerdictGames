"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { searchGames } from "@/lib/api";
import type { SearchFilters, SortOption, MonetizationType, Platform } from "@/lib/types";

const allGenres: string[] = [
  "Action", "Action RPG", "Adventure", "Battle Royale", "Card Game",
  "Detective", "Endless Runner", "Horror", "Indie", "Metroidvania",
  "MMORPG", "Open World", "Party", "Platformer", "Puzzle",
  "Roguelike", "RPG", "Sandbox", "Shooter", "Simulation",
  "Social Deduction", "Strategy", "Survival", "Turn-Based Strategy",
];

const allYears: string[] = [
  "2025", "2024", "2023", "2022", "2021", "2020",
  "2019", "2018", "2017", "2016", "2015", "2014", "2012", "2011",
];
import GameGrid from "@/components/GameGrid";
import FilterChips from "@/components/ui/FilterChips";
import SortDropdown from "@/components/ui/SortDropdown";
import { GameGridSkeleton } from "@/components/ui/Skeleton";
import type { Metadata } from "next";

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
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

  const filters: SearchFilters = {
    query: query || undefined,
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

  // Sync URL on query change
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (platform !== "All") params.set("platform", platform);
    if (genre) params.set("genre", genre);
    if (sort !== "relevance") params.set("sort", sort);
    router.replace(`/search?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, platform, genre, sort]);

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
          Find your next favorite PC or Android game.
        </p>
      </motion.div>

      {/* Sticky search bar */}
      <div className="sticky top-12 md:top-14 z-40 bg-background/90 backdrop-blur-md py-3 -mx-4 px-4 border-b border-border">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search by title, genre, developer..."
          className="w-full h-11 px-4 text-sm rounded-sm border border-border bg-surface-2 text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent transition-colors"
          autoFocus
        />
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
              Platform
            </label>
            <FilterChips
              options={["All", "PC", "Android"] as (Platform | "All")[]}
              selected={platform}
              onChange={(v) => {
                setPlatform(v);
                setPage(1);
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
              Monetization
            </label>
            <FilterChips
              options={["All", "Free", "Paid", "Free with IAP", "Free with Ads"] as (MonetizationType | "All")[]}
              selected={monetization}
              onChange={(v) => {
                setMonetization(v);
                setPage(1);
              }}
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
              className="h-8 px-2 text-xs rounded-sm border border-border bg-surface-2 text-foreground focus:outline-none focus:border-accent"
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
              className="h-8 px-2 text-xs rounded-sm border border-border bg-surface-2 text-foreground focus:outline-none focus:border-accent"
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
        {isLoading ? (
          <GameGridSkeleton count={8} />
        ) : data && data.items.length > 0 ? (
          <>
            <p className="text-xs text-tertiary mb-4">
              {data.total} game{data.total !== 1 ? "s" : ""} found
            </p>
            <GameGrid games={data.items} />

            {/* Load more */}
            {data.hasMore && (
              <div className="flex justify-center pt-8">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="px-6 py-2 text-sm font-medium text-accent border border-accent rounded-sm hover:bg-accent-soft transition-colors"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 space-y-3">
            <div className="text-4xl">🎮</div>
            <p className="text-foreground font-semibold">No games found</p>
            <p className="text-sm text-secondary">
              Try adjusting your filters or search for something else.
            </p>
          </div>
        )}
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
