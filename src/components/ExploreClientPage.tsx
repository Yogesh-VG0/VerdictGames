"use client";

import { preferredScrollBehavior } from '@/lib/utils/motion';
import { useOptimistic, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getRawgList, type RawgListGameItem, type RawgListType, type RawgListResponse, type ExploreSort } from "@/lib/api";
import SortDropdown from '@/components/ui/SortDropdown';
import PlatformIcon from "@/components/ui/PlatformIcon";
import HeroImage from "@/components/ui/HeroImage";
import { Flame, Trophy, Clock, Star, Gamepad2, Users, TrendingUp } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { cn } from "@/lib/utils";
import { formatReleaseTiming } from '@/lib/utils/release-timing';

const CURRENT_YEAR = new Date().getFullYear();
const LAST_YEAR = CURRENT_YEAR - 1;

const TABS = [
  { id: "best-of-year" as RawgListType, label: "Most Anticipated", icon: Flame, desc: "Upcoming releases ranked by community interest" },
  { id: "popular-in-year" as RawgListType, label: `Best of ${LAST_YEAR}`, icon: Trophy, desc: `Top games from ${LAST_YEAR}` },
  { id: "all-time" as RawgListType, label: "All-Time Top 250", icon: Star, desc: "Community favourites through the years" },
  { id: "recent" as RawgListType, label: "New Releases", icon: Clock, desc: "Released in the last 30 days" },
  { id: "genre" as RawgListType, label: "Browse by Genre", icon: Gamepad2, desc: "Explore games by genre" },
] as const;

const GENRES = [
  { slug: "action", label: "Action" },
  { slug: "adventure", label: "Adventure" },
  { slug: "role-playing-games-rpg", label: "RPG" },
  { slug: "shooter", label: "Shooter" },
  { slug: "strategy", label: "Strategy" },
  { slug: "simulation", label: "Simulation" },
  { slug: "puzzle", label: "Puzzle" },
  { slug: "racing", label: "Racing" },
  { slug: "sports", label: "Sports" },
  { slug: "fighting", label: "Fighting" },
  { slug: "platformer", label: "Platformer" },
  { slug: "indie", label: "Indie" },
];

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
      href={`/game/${game.slug}`}
      prefetch={false}
      className="group signal-card relative rounded-2xl border border-border bg-surface overflow-hidden hover:border-border-hover"
    >
      {/* Image */}
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-2">
        {game.image ? (
          <HeroImage
            src={game.image}
            alt={game.name}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            fit={game.imageKind === 'artwork' ? 'contain' : 'cover'}
            className={cn(game.imageKind === 'artwork' ? 'object-contain bg-surface-2' : 'object-cover', 'motion-safe:group-hover:scale-[1.03] transition-transform duration-200')}
            priority={priority}
            fallbackClassName="bg-surface-2"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-accent/10 to-pixel-cyan/10 flex items-center justify-center">
            <Gamepad2 className="w-8 h-8 text-tertiary" />
          </div>
        )}

        {/* Rank badge */}
        {rank && (
          <div className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-black/70 backdrop-blur-sm flex items-center justify-center text-[10px] font-bold text-white border border-white/10">
            #{rank}
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {/* Bottom info on image */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-sm font-bold text-white line-clamp-2 leading-snug drop-shadow-lg">{game.name}</h3>
          {game.earlyAccess && <p className="mt-1 text-[10px] text-white/80">Early Access · full release pending</p>}
          <div className="flex items-center gap-1.5 mt-1">
            {game.genres.slice(0, 2).map((g, i) => (
              <span key={g} className="text-[10px] text-white/60">
                {i > 0 && <span className="mr-1">·</span>}{g}
              </span>
            ))}
            <span className="ml-auto text-[10px] font-medium">
              {game.releaseTiming ? (
                <span className={game.releaseTiming.precision === 'tba' ? "text-yellow-400" : "text-white/70"}>{formatReleaseTiming(game.releaseTiming)}</span>
              ) : game.tba ? (
                <span className="text-yellow-400">TBA</span>
              ) : game.releaseWindow ? (
                <span className="text-white/70">{game.releaseWindow}</span>
              ) : game.released ? (
                <span className="text-white/50">{new Date(game.released).getFullYear()}</span>
              ) : null}
            </span>
          </div>
        </div>
      </div>

      {/* Stats + Platforms bar */}
      <div className="px-3 py-2 space-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-secondary">
          {!showRating && game.added > 0 && (
            <span className="flex items-center gap-1" title="RAWG library additions, not wishlists">
              <Users className="w-3 h-3 text-tertiary" />
              {formatNumber(game.added)}
            </span>
          )}
          {game.metricSource === 'catalogue' && game.ratingsCount > 0 && <span title="Catalogue review count">{formatNumber(game.ratingsCount)} reviews</span>}
          {game.metricSource === 'catalogue' && Boolean(game.verdictScore) && <span className="font-semibold text-accent" title="Stored Verdict Score">{Math.round(game.verdictScore!)} / 100</span>}
          {showRating && game.metricSource === 'rawg' && game.ratingsCount > 0 && <><span className="whitespace-nowrap font-semibold text-accent" title="RAWG community rating">{game.rating.toFixed(2)} / 5</span><span className="whitespace-nowrap">{formatNumber(game.ratingsCount)} ratings</span></>}
          {!showRating && game.toplay > 0 && (
            <span className="flex items-center gap-1" title="RAWG want-to-play status">
              <Clock className="w-3 h-3 text-tertiary" />
              {formatNumber(game.toplay)}
            </span>
          )}
        </div>
        {uniquePlatforms.length > 0 && (
          <div className="flex items-center gap-1.5">
            {uniquePlatforms.map((p) => (
              <PlatformIcon key={p} platform={p} size={12} className="text-tertiary opacity-70" />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function GameCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="aspect-[3/4] bg-surface-2 motion-safe:animate-pulse" />
      <div className="px-3 py-2 flex gap-3">
        <div className="h-3 w-16 bg-surface-2 rounded motion-safe:animate-pulse" />
        <div className="h-3 w-12 bg-surface-2 rounded motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

export default function ExplorePage({ initialData, initialKey = '' }: { initialData?: RawgListResponse; initialKey?: string }) {
  const router = useRouter();
  const routeParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimisticSearch, setOptimisticSearch] = useOptimistic(routeParams.toString());
  const params = new URLSearchParams(optimisticSearch);
  const activeTab = (TABS.some(tab => tab.id === params.get('type')) ? params.get('type') : 'best-of-year') as RawgListType;
  const page = Math.max(1, Math.min(250, Math.floor(Number(params.get('page')) || 1)));
  const selectedGenre = GENRES.some(genre => genre.slug === params.get('genre')) ? params.get('genre')! : 'action';
  const year = Math.max(1970, Math.min(CURRENT_YEAR, Math.floor(Number(params.get('year')) || LAST_YEAR)));
  const requestedSort = params.get('sort') || 'default';
  const validSort = (activeTab === 'all-time' ? ['default','rating'] : ['default','popular','name-asc','name-desc','newest','oldest',...(activeTab === 'best-of-year' ? [] : ['rating','added'])]).includes(requestedSort);
  const sort = (!validSort ? 'default' : requestedSort) as ExploreSort;
  const platform = ['PC','PlayStation 5','PlayStation 4','Xbox Series X|S','Xbox One','Nintendo Switch','Android','iOS','Linux','macOS'].includes(params.get('platform') || '') ? params.get('platform')! : '';
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
  const queryKey = [activeTab, page, year, selectedGenre, sort, platform].join('|');

  const PAGE_SIZE = 20;
  
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
    updateFilters({ type: tab, sort: '', genre: '', platform: '' });
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
        {activeTab === 'popular-in-year' && <div className="grid gap-2"><label htmlFor="explore-year" className="text-xs text-secondary">Release year</label><SortDropdown id="explore-year" selected={String(year)} onChange={value => updateFilters({ year: value })} options={Array.from({ length: CURRENT_YEAR - 1970 + 1 }, (_, index) => ({ label: String(CURRENT_YEAR - index), value: String(CURRENT_YEAR - index) }))} /></div>}
        <div className="grid gap-2"><label htmlFor="explore-platform" className="text-xs text-secondary">Platform</label><SortDropdown id="explore-platform" selected={platform} onChange={value => updateFilters({ platform: value })} options={['', 'PC', 'PlayStation 5', 'PlayStation 4', 'Xbox Series X|S', 'Xbox One', 'Nintendo Switch', 'Android', 'iOS', 'Linux', 'macOS'].map(value => ({ label: value || 'All platforms', value }))} /></div>
        <div className="grid gap-2"><label htmlFor="explore-sort" className="text-xs text-secondary">Sort</label><SortDropdown id="explore-sort" selected={sort} onChange={value => updateFilters({ sort: value })} options={[
          { label: ['all-time','popular-in-year'].includes(activeTab) ? 'RAWG community ranking' : activeTab === 'best-of-year' ? 'Community interest' : activeTab === 'recent' ? 'Newest releases' : 'Catalogue popularity', value: 'default' as ExploreSort },
          ...(activeTab === 'all-time' ? [] : [{ label: activeTab === 'best-of-year' ? 'Community interest' : 'Popularity (reviews)', value: 'popular' as ExploreSort }]),
          ...(activeTab === 'best-of-year' ? [] : [{ label: 'Verdict ranking', value: 'rating' as ExploreSort }]),
          ...(activeTab === 'all-time' ? [] : [{ label: 'Name A–Z', value: 'name-asc' as ExploreSort }, { label: 'Name Z–A', value: 'name-desc' as ExploreSort },
          { label: 'Release newest', value: 'newest' as ExploreSort }, { label: 'Release oldest', value: 'oldest' as ExploreSort },
          ...(activeTab === 'best-of-year' ? [] : [{ label: 'Added to catalogue', value: 'added' as ExploreSort }])]),
        ]} /></div>
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
          <>{Array.from({ length: 20 }).map((_, i) => <GameCardSkeleton key={i} />)}</>
        ) : query.isError ? (
          <div className="col-span-full py-12 text-center space-y-3" role="alert">
            <p>The game catalogue is temporarily unavailable.</p>
            <button onClick={() => query.refetch()} className="text-accent underline">Try again</button>
          </div>
        ) : query.data?.items.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <Gamepad2 className="w-12 h-12 text-tertiary mx-auto mb-3" />
            <p className="text-secondary">No games found for this category.</p>
          </div>
        ) : (
          query.data?.items.map((game, i) => (
            <GameCard
              key={game.slug}
              game={game}
              rank={activeTab === "all-time" ? game.rank : undefined}
              priority={i < 5}
              showRating={activeTab !== 'best-of-year'}
            />
          ))
        )}
      </div>

      {/* Pagination — RAWG API caps at ~500 pages (10,000 results) */}
      {query.data && !isPending && query.data.count > 0 && (
        <Pagination
          currentPage={page}
          totalPages={Math.min(Math.ceil(query.data.count / PAGE_SIZE), 400)}
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
