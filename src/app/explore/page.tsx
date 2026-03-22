"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getRawgList, type RawgListGameItem, type RawgListType } from "@/lib/api";
import { Flame, Trophy, Clock, Star, Gamepad2, ChevronRight, Users, Calendar, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "best-of-year" as RawgListType, label: "Most Anticipated", icon: Flame, desc: "Most hyped games of 2026" },
  { id: "popular-in-year" as RawgListType, label: "Best of 2025", icon: Trophy, desc: "Top games from last year" },
  { id: "all-time" as RawgListType, label: "All-Time Top 250", icon: Star, desc: "Greatest games ever made" },
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

function GameCard({ game, rank }: { game: RawgListGameItem; rank?: number }) {
  // Check if this game exists in our DB by trying to link to it
  const slug = game.slug;

  return (
    <Link
      href={`/game/${slug}`}
      className="group relative rounded-2xl border border-border bg-surface overflow-hidden hover:border-accent/40 hover:shadow-lg transition-all duration-300"
    >
      {/* Image */}
      <div className="relative aspect-[16/9] overflow-hidden bg-surface-2">
        {game.image ? (
          <Image
            src={game.image}
            alt={game.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-accent/10 to-pixel-cyan/10 flex items-center justify-center">
            <Gamepad2 className="w-8 h-8 text-tertiary" />
          </div>
        )}

        {/* Rank badge */}
        {rank && (
          <div className="absolute top-2 left-2 w-8 h-8 rounded-lg bg-black/70 backdrop-blur-sm flex items-center justify-center text-xs font-bold text-white border border-white/10">
            #{rank}
          </div>
        )}

        {/* Metacritic / Rating badge */}
        {(game.metacritic || game.rating > 0) && (
          <div className={cn(
            "absolute top-2 right-2 px-2 py-0.5 rounded-lg text-xs font-bold backdrop-blur-sm border",
            game.metacritic && game.metacritic >= 80
              ? "bg-green-500/20 text-green-400 border-green-500/30"
              : game.metacritic && game.metacritic >= 60
              ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
              : "bg-white/10 text-white/80 border-white/20"
          )}>
            {game.metacritic ? `${game.metacritic}` : `${game.rating.toFixed(1)}★`}
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />

        {/* Bottom info on image */}
        <div className="absolute bottom-2 left-2 right-2">
          <h3 className="text-sm font-bold text-white line-clamp-1 drop-shadow-lg">{game.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            {game.genres.slice(0, 2).map((g) => (
              <span key={g} className="text-[10px] text-white/70">{g}</span>
            ))}
            {game.released && !game.tba && (
              <span className="text-[10px] text-white/50 ml-auto">{new Date(game.released).getFullYear()}</span>
            )}
            {game.tba && (
              <span className="text-[10px] text-accent ml-auto">TBA</span>
            )}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-3 py-2 flex items-center gap-3 text-[10px] text-secondary">
        {game.added > 0 && (
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {formatNumber(game.added)} added
          </span>
        )}
        {game.toplay > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatNumber(game.toplay)} want
          </span>
        )}
        {game.playing > 0 && (
          <span className="flex items-center gap-1 text-accent">
            <Gamepad2 className="w-3 h-3" />
            {formatNumber(game.playing)}
          </span>
        )}
        {game.platforms.length > 0 && (
          <span className="ml-auto text-tertiary truncate max-w-[100px]">
            {game.platforms.slice(0, 2).join(" · ")}
          </span>
        )}
      </div>
    </Link>
  );
}

function GameCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="aspect-[16/9] bg-surface-2 animate-pulse" />
      <div className="px-3 py-2 flex gap-3">
        <div className="h-3 w-16 bg-surface-2 rounded animate-pulse" />
        <div className="h-3 w-12 bg-surface-2 rounded animate-pulse" />
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState<RawgListType>("best-of-year");
  const [page, setPage] = useState(1);
  const [selectedGenre, setSelectedGenre] = useState("action");

  const query = useQuery({
    queryKey: ["rawg-list", activeTab, page, activeTab === "genre" ? selectedGenre : null],
    queryFn: () => getRawgList(activeTab, {
      page,
      pageSize: 20,
      year: activeTab === "popular-in-year" ? 2025 : undefined,
      genre: activeTab === "genre" ? selectedGenre : undefined,
    }),
    staleTime: 60_000,
  });

  const handleTabChange = (tab: RawgListType) => {
    setActiveTab(tab);
    setPage(1);
  };

  const activeTabInfo = TABS.find((t) => t.id === activeTab);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
          <TrendingUp className="w-7 h-7 text-accent" />
          Explore Games
        </h1>
        <p className="text-sm text-secondary mt-1">
          Discover the most popular, anticipated, and highest-rated games — powered by RAWG community data.
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
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                isActive
                  ? "bg-accent text-white shadow-lg shadow-accent/20"
                  : "bg-surface border border-border text-secondary hover:text-foreground hover:border-border-hover"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Genre selector (only for genre tab) */}
      <AnimatePresence mode="wait">
        {activeTab === "genre" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              {GENRES.map((g) => (
                <button
                  key={g.slug}
                  onClick={() => { setSelectedGenre(g.slug); setPage(1); }}
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">{activeTabInfo?.label}</h2>
          <p className="text-xs text-tertiary">{activeTabInfo?.desc}</p>
        </div>
        {query.data && (
          <span className="text-xs text-tertiary">
            {query.data.count.toLocaleString()} games
          </span>
        )}
      </div>

      {/* Game grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {query.isLoading ? (
          Array.from({ length: 20 }).map((_, i) => <GameCardSkeleton key={i} />)
        ) : query.data?.items.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <Gamepad2 className="w-12 h-12 text-tertiary mx-auto mb-3" />
            <p className="text-secondary">No games found for this category.</p>
          </div>
        ) : (
          query.data?.items.map((game, i) => (
            <GameCard
              key={game.rawgId}
              game={game}
              rank={activeTab === "all-time" ? (page - 1) * 20 + i + 1 : undefined}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {query.data && (query.data.hasNext || page > 1) && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-surface border border-border text-secondary hover:text-foreground hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Previous
          </button>
          <span className="text-sm text-secondary tabular-nums">
            Page {page}
            {query.data.count > 0 && ` of ${Math.ceil(query.data.count / 20)}`}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!query.data.hasNext}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-surface border border-border text-secondary hover:text-foreground hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attribution */}
      <p className="text-center text-[10px] text-tertiary pt-4">
        Game data and community rankings powered by <a href="https://rawg.io" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">RAWG.io</a>
      </p>
    </div>
  );
}
