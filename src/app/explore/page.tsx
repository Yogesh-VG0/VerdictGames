"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getRawgList, type RawgListGameItem, type RawgListType } from "@/lib/api";
import PlatformIcon from "@/components/ui/PlatformIcon";
import { Flame, Trophy, Clock, Star, Gamepad2, Users, TrendingUp } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
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

function GameCard({ game, rank }: { game: RawgListGameItem; rank?: number }) {
  const platforms = game.platforms.map(mapPlatform).filter(Boolean) as string[];
  // Dedupe
  const uniquePlatforms = [...new Set(platforms)].slice(0, 4);

  return (
    <Link
      href={`/game/${game.slug}?rawgId=${game.rawgId}`}
      className="group relative rounded-2xl border border-border bg-surface overflow-hidden hover:border-accent/40 hover:shadow-lg transition-all duration-300"
    >
      {/* Image */}
      <div className="relative aspect-[16/9] overflow-hidden bg-surface-2">
        {game.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.image}
            alt={game.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
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
          <h3 className="text-sm font-bold text-white line-clamp-1 drop-shadow-lg">{game.name}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            {game.genres.slice(0, 2).map((g, i) => (
              <span key={g} className="text-[10px] text-white/60">
                {i > 0 && <span className="mr-1">·</span>}{g}
              </span>
            ))}
            <span className="ml-auto text-[10px] font-medium">
              {game.tba ? (
                <span className="text-yellow-400">TBA</span>
              ) : game.released ? (
                <span className="text-white/50">{new Date(game.released).getFullYear()}</span>
              ) : null}
            </span>
          </div>
        </div>
      </div>

      {/* Stats + Platforms bar */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-[10px] text-secondary">
          {game.added > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 text-tertiary" />
              {formatNumber(game.added)}
            </span>
          )}
          {game.toplay > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-tertiary" />
              {formatNumber(game.toplay)}
            </span>
          )}
          {game.playing > 0 && (
            <span className="flex items-center gap-1 text-accent">
              <Gamepad2 className="w-3 h-3" />
              {formatNumber(game.playing)}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
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

      {/* Pagination — RAWG API caps at ~500 pages (10,000 results) */}
      {query.data && query.data.count > 0 && (
        <Pagination
          currentPage={page}
          totalPages={Math.min(Math.ceil(query.data.count / 20), 500)}
          onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        />
      )}

      {/* Attribution */}
      <p className="text-center text-[10px] text-tertiary pt-4">
        Game data and community rankings powered by <a href="https://rawg.io" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">RAWG.io</a>
      </p>
    </div>
  );
}
