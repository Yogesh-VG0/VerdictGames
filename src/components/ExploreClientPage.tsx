"use client";

import { preferredScrollBehavior } from '@/lib/utils/motion';
import { useOptimistic, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getRawgList, type RawgListGameItem, type RawgListType, type RawgListResponse } from "@/lib/api";
import SortDropdown from '@/components/ui/SortDropdown';
import PlatformIcon from "@/components/ui/PlatformIcon";
import CatalogueCardArtwork, { CatalogueCardSkeleton } from "@/components/CatalogueCardArtwork";
import { catalogueGameHref } from "@/lib/utils/artwork";
import { EXPLORE_GENRES, EXPLORE_MAX_PAGE, EXPLORE_PAGE_SIZE, EXPLORE_PLATFORMS, exploreFilterKey, exploreSortOptions, parseExploreFilters } from "@/lib/utils/explore-filters";
import { Flame, Trophy, Clock, Star, Gamepad2, Users, TrendingUp } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { cn } from "@/lib/utils";
import { formatReleaseTiming } from '@/lib/utils/release-timing';

const TABS = [
  { id: "best-of-year" as RawgListType, label: "Most Anticipated", icon: Flame, desc: "Upcoming releases ranked by community interest" },
  { id: "popular-in-year" as RawgListType, label: 'Best by Year', icon: Trophy, desc: 'Top released games from the selected year' },
  { id: "all-time" as RawgListType, label: "All-Time Top 250", icon: Star, desc: "Community favourites through the years" },
  { id: "recent" as RawgListType, label: "New Releases", icon: Clock, desc: "Released in the last 30 days" },
  { id: "genre" as RawgListType, label: "Browse by Genre", icon: Gamepad2, desc: "Explore games by genre" },
] as const;

const GENRES = Object.entries(EXPLORE_GENRES).map(([slug, label]) => ({ slug, label }));

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/** Map RAWG platform names to our PlatformIcon-compatible names */
function mapPlatform(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("pc")) return "PC";
  if (n.includes("playstation 5")) return "PlayStation 5";
  if (n.includes("playstation 4")) return "PlayStation 4";
  if (n.includes("xbox series")) return "Xbox Series X|S";
  if (n.includes("xbox one")) return "Xbox One";
  if (n.includes("switch")) return "Nintendo Switch";
  if (n.includes("android")) return "Android";
  if (n.includes("ios")) return "iOS";
  if (n.includes("linux")) return "Linux";
  if (n.includes("macos") || n.includes("macintosh")) return "macOS";
  return null;
}

function GameCard({ game, rank, priority = false, showRating = true }: { game: RawgListGameItem; rank?: number; priority?: boolean; showRating?: boolean }) {
  const platforms = game.platforms.map(mapPlatform).filter(Boolean) as string[];
  // Dedupe
  const uniquePlatforms = [...new Set(platforms)].slice(0, 4);

  return (
    <Link
      href={catalogueGameHref(game)}
      prefetch={false}
      className="group signal-card relative flex flex-col rounded-2xl border border-border bg-surface overflow-hidden hover:border-border-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
    >
      <div className="relative">
        <CatalogueCardArtwork image={game.image} imageKind={game.imageKind} layout="portrait" priority={priority} />
        {rank != null && <span className="absolute top-2 left-2 rounded-lg border border-white/10 bg-black/75 px-2 py-1 text-xs font-bold text-white">#{rank}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2.5 sm:p-3">
        <h3 className="min-h-10 line-clamp-2 break-words text-sm font-bold leading-5 text-foreground" title={game.name}>{game.name}</h3>
        <p className="min-h-8 line-clamp-2 text-xs leading-4 text-secondary">{game.genres.slice(0, 2).join(' · ')}</p>
        <div className="min-h-12 text-xs leading-4">
          <p className="font-medium text-foreground">
            {game.releaseTiming ? formatReleaseTiming(game.releaseTiming)
              : game.tba ? 'TBA' : game.releaseWindow ?? game.released?.slice(0, 4)}
          </p>
          {game.earlyAccess && <p className="text-secondary">Early Access · full release pending</p>}
        </div>
        <div className="flex min-h-8 min-w-0 flex-wrap content-start items-center gap-x-2 gap-y-1 text-[11px] text-secondary">
          {!showRating && game.added > 0 && (
            <span className="flex items-center gap-1" title="RAWG library additions, not wishlists">
              <Users aria-hidden="true" className="w-3 h-3 text-tertiary" />
              {formatNumber(game.added)}<span className="sr-only"> RAWG library additions</span>
            </span>
          )}
          {game.metricSource === 'catalogue' && game.ratingsCount > 0 && <span title="Catalogue review count">{formatNumber(game.ratingsCount)} reviews</span>}
          {game.metricSource === 'catalogue' && Boolean(game.verdictScore) && <span className="font-semibold text-accent" title="Stored Verdict Score">{Math.round(game.verdictScore!)} / 100</span>}
          {showRating && game.metricSource === 'rawg' && game.ratingsCount > 0 && <><span className="whitespace-nowrap font-semibold text-accent" title="RAWG community rating">{game.rating.toFixed(2)} / 5</span><span className="whitespace-nowrap">{formatNumber(game.ratingsCount)} ratings</span></>}
          {!showRating && game.toplay > 0 && (
            <span className="flex items-center gap-1" title="RAWG want-to-play status">
              <Clock aria-hidden="true" className="w-3 h-3 text-tertiary" />
              {formatNumber(game.toplay)}<span className="sr-only"> RAWG want to play</span>
            </span>
          )}
        </div>
        <div className="mt-auto flex min-h-3 items-center gap-1.5">
            {uniquePlatforms.map((p) => (
              <PlatformIcon key={p} platform={p} size={12} className="text-tertiary opacity-70" />
            ))}
        </div>
      </div>
    </Link>
  );
}


export default function ExplorePage({ initialData, initialKey = '' }: { initialData?: RawgListResponse; initialKey?: string }) {
  const router = useRouter();
  const routeParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimisticSearch, setOptimisticSearch] = useOptimistic(routeParams.toString());
  const currentYear = new Date().getUTCFullYear();
  const params = new URLSearchParams(optimisticSearch);
  const filters = parseExploreFilters(key => params.get(key), currentYear);
  const { type: activeTab, page, genre: selectedGenre, year, sort, platform } = filters;
  function updateFilters(changes: Record<string, string | number>) {
    const next = new URLSearchParams(params.toString());
    next.delete('page');
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value === 'default' || value === 1) next.delete(key); else next.set(key, String(value));
    }
    startTransition(() => {
      setOptimisticSearch(next.toString());
      router.push(`/explore${next.size ? `?${next}` : ''}`, { scroll: false });
    });
  }
  const queryKey = exploreFilterKey(filters);

  const PAGE_SIZE = EXPLORE_PAGE_SIZE;
  
  const query = useQuery({
    queryKey: ["rawg-list", queryKey],
    queryFn: () => getRawgList(activeTab, {
      page,
      pageSize: PAGE_SIZE,
      year: activeTab === "popular-in-year" ? year : undefined,
      genre: activeTab === "genre" ? selectedGenre : undefined,
      sort, platform,
    }),
    staleTime: 60 * 60_000,
    initialData: queryKey === initialKey ? initialData : undefined,
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !isPending && !(queryKey === initialKey && initialData),
  });

  const handleTabChange = (tab: RawgListType) => {
    if (tab === activeTab) return;
    updateFilters({ type: tab, sort: '', genre: '', year: '' });
  };

  const activeTabInfo = TABS.find((t) => t.id === activeTab);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 overflow-x-hidden">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
          <TrendingUp className="w-7 h-7 text-pink-500" />
          <span className="bg-gradient-to-r from-pink-500 via-rose-400 to-amber-400 bg-clip-text text-transparent">Explore Games</span>
        </h1>
        <p className="text-sm text-secondary mt-1">
          Discover the most popular, anticipated, and highest-rated games.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              aria-pressed={isActive}
              onFocus={event => event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                isActive
                  ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20"
                  : "bg-surface border border-border text-secondary hover:text-foreground hover:border-border-hover"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.id === 'popular-in-year' ? `Best of ${year}` : tab.label}
            </button>
          );
        })}
      </div>

      {/* Genre selector (only for genre tab) */}
      <AnimatePresence mode="wait">
        {activeTab === "genre" && (
          <motion.div
            initial={false}
            animate={undefined}
            exit={undefined}
            className="overflow-hidden"
          >
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              {GENRES.map((g) => (
                <button
                  key={g.slug}
                  aria-pressed={selectedGenre === g.slug}
                  onClick={() => updateFilters({ genre: g.slug })}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                    selectedGenre === g.slug
                      ? "bg-accent/20 text-accent border border-accent/30"
                      : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section header */}
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-surface p-4">
        {activeTab === 'popular-in-year' && <div className="grid gap-2"><label htmlFor="explore-year" className="text-xs text-secondary">Release year</label><SortDropdown id="explore-year" selected={String(year)} onChange={value => updateFilters({ year: value })} options={Array.from({ length: currentYear - 1970 + 1 }, (_, index) => ({ label: String(currentYear - index), value: String(currentYear - index) }))} /></div>}
        <div className="grid gap-2"><label htmlFor="explore-platform" className="text-xs text-secondary">Platform</label><SortDropdown id="explore-platform" selected={platform} onChange={value => updateFilters({ platform: value })} options={['', ...EXPLORE_PLATFORMS].map(value => ({ label: value || 'All platforms', value }))} /></div>
        <div className="grid gap-2"><label htmlFor="explore-sort" className="text-xs text-secondary">Sort</label><SortDropdown id="explore-sort" selected={sort} onChange={value => updateFilters({ sort: value })} options={[...exploreSortOptions(activeTab)]} /></div>
        {params.size > 0 && <button className="h-11 px-3 text-sm text-accent underline" onClick={() => startTransition(() => { setOptimisticSearch(''); router.push('/explore', { scroll: false }); })}>Reset filters</button>}
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground">{activeTab === 'popular-in-year' ? `Best of ${year}` : activeTabInfo?.label}</h2>
          <p className="max-w-3xl text-sm text-secondary leading-relaxed">{activeTabInfo?.desc}</p>
        </div>
        {query.data && !isPending && (
          <span className="shrink-0 whitespace-nowrap text-xs text-tertiary">
            {query.data.count.toLocaleString()} {query.data.count === 1 ? 'game' : 'games'}
          </span>
        )}
      </div>
      {query.data?.degraded && !isPending && <p role="status" className="text-sm text-secondary">{query.data.notice || (query.data.source === 'rawg' ? 'Showing saved RAWG rankings while we check for updates.' : activeTab === 'best-of-year' ? 'Showing saved upcoming games. Community counts are temporarily unavailable.' : 'RAWG rankings are temporarily unavailable. Showing Verdict rankings instead.')}</p>}

      {(isPending || query.isLoading) && <p role="status" className="flex items-center gap-2 text-sm text-secondary"><span className="h-2 w-2 rounded-full bg-accent motion-safe:animate-pulse" aria-hidden="true" />Updating games…</p>}
      {/* Feedback belongs beside the results being replaced, not in a distant toast. */}
      <div aria-busy={isPending || query.isLoading} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
        {isPending || query.isLoading ? (
          <>{Array.from({ length: PAGE_SIZE }).map((_, i) => <CatalogueCardSkeleton key={i} />)}</>
        ) : query.isError ? (
          <div className="col-span-full py-12 text-center space-y-3" role="alert">
            <p>The game catalogue is temporarily unavailable.</p>
            <button onClick={() => query.refetch()} className="text-accent underline">Try again</button>
          </div>
        ) : query.data?.items.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <Gamepad2 className="w-12 h-12 text-tertiary mx-auto mb-3" />
            <p className="text-secondary">{page > 1 && query.data.count > 0 ? "You have reached the end of these results." : query.data.degraded ? "Results are unavailable for these filters right now." : "No games match these filters."}</p>
          </div>
        ) : (
          query.data?.items.map((game, i) => (
            <GameCard
              key={game.slug}
              game={game}
              rank={activeTab === "all-time" ? game.rank : undefined}
              priority={i === 0}
              showRating={activeTab !== 'best-of-year'}
            />
          ))
        )}
      </div>

      {/* Pagination — RAWG API caps at ~500 pages (10,000 results) */}
      {query.data && !isPending && query.data.count > 0 && (
        <Pagination
          currentPage={page}
          totalPages={Math.min(Math.ceil(query.data.count / PAGE_SIZE), EXPLORE_MAX_PAGE)}
          onPageChange={(p) => { updateFilters({ page: p }); window.scrollTo({ top: 0, behavior: preferredScrollBehavior() }); }}
        />
      )}

      {query.data && !isPending && <details className="text-xs text-secondary"><summary className="cursor-pointer py-2">How these games are ranked</summary><p className="max-w-3xl leading-relaxed">{query.data.definition}</p>{query.data.fetchedAt && <p className="mt-2">Updated {new Date(query.data.fetchedAt).toLocaleDateString()}</p>}</details>}

      {/* Attribution */}
      <p className="text-center text-[10px] text-tertiary pt-4">
        Game data from <a href="https://rawg.io" target="_blank" rel="noreferrer" className="underline">RAWG</a>, IGDB and Steam.
      </p>
    </div>
  );
}
