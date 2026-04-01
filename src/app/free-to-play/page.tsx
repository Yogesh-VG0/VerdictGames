"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Gamepad2, SlidersHorizontal, Crown, ExternalLink } from "lucide-react";
import { getGXFreeToPlay, getGXTopGames } from "@/lib/api";
import type { GXFreeGame, GXTopGame } from "@/lib/types";
import { slugify } from "@/lib/utils/slugify";
import { cn } from "@/lib/utils";
import GXPageNav from "@/components/GXPageNav";

type ActiveTab = "free" | "subscriptions";

function FreeGameCard({ game, priority = false }: { game: GXFreeGame; priority?: boolean }) {
  return (
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
              priority={priority}
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
  );
}

function SubscriptionGameCard({ game, priority = false }: { game: GXTopGame; priority?: boolean }) {
  return (
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
              priority={priority}
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
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="aspect-[3/4] bg-surface-2 animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-3/4 bg-surface-2 rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-surface-2 rounded animate-pulse" />
      </div>
    </div>
  );
}

export default function FreeToPlayPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("free");
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [selectedService, setSelectedService] = useState("All");

  const { data: freeGames, isLoading: freeLoading } = useQuery({
    queryKey: ["gx-free-to-play-full"],
    queryFn: () => getGXFreeToPlay(),
    staleTime: 60 * 60 * 1000,
  });

  const { data: topGames, isLoading: topLoading } = useQuery({
    queryKey: ["gx-top-games-full"],
    queryFn: () => getGXTopGames(),
    staleTime: 60 * 60 * 1000,
    enabled: activeTab === "subscriptions",
  });

  // Extract genres from current tab data
  const genres = useMemo(() => {
    const data = activeTab === "free" ? freeGames : topGames;
    if (!data) return [];
    const set = new Set<string>();
    data.forEach((g) => g.genres.forEach((ge) => set.add(ge)));
    return Array.from(set).sort();
  }, [freeGames, topGames, activeTab]);

  // Extract services from top games
  const services = useMemo(() => {
    if (!topGames) return [];
    const set = new Set<string>();
    topGames.forEach((g) => { if (g.serviceName) set.add(g.serviceName); });
    return Array.from(set).sort();
  }, [topGames]);

  // Filter free games
  const filteredFree = useMemo(() => {
    if (!freeGames) return [];
    if (selectedGenre === "All") return freeGames;
    return freeGames.filter((g) => g.genres.includes(selectedGenre));
  }, [freeGames, selectedGenre]);

  // Filter subscription games
  const filteredSubs = useMemo(() => {
    if (!topGames) return [];
    let result = [...topGames];
    if (selectedService !== "All") {
      result = result.filter((g) => g.serviceName === selectedService);
    }
    if (selectedGenre !== "All") {
      result = result.filter((g) => g.genres.includes(selectedGenre));
    }
    return result;
  }, [topGames, selectedGenre, selectedService]);

  const isLoading = activeTab === "free" ? freeLoading : topLoading;
  const filteredCount = activeTab === "free" ? filteredFree.length : filteredSubs.length;

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSelectedGenre("All");
    setSelectedService("All");
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 overflow-x-hidden page-enter">
      {/* Quick Nav */}
      <GXPageNav />

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
          <Gift className="w-7 h-7 text-pixel-green" />
          <span className="bg-gradient-to-r from-pixel-green via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Free to Play
          </span>
        </h1>
        <p className="text-sm text-secondary mt-1">
          The best free games and subscription service picks — updated live
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          onClick={() => handleTabChange("free")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
            activeTab === "free"
              ? "bg-pixel-green/20 text-pixel-green border border-pixel-green/30 shadow-sm"
              : "bg-surface border border-border text-secondary hover:text-foreground hover:border-border-hover"
          )}
        >
          <Gift className="w-4 h-4" />
          Free Games
        </button>
        <button
          onClick={() => handleTabChange("subscriptions")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
            activeTab === "subscriptions"
              ? "bg-accent/20 text-accent border border-accent/30 shadow-sm"
              : "bg-surface border border-border text-secondary hover:text-foreground hover:border-border-hover"
          )}
        >
          <Crown className="w-4 h-4" />
          Game Pass & PS Plus
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Service filter (subscriptions tab only) */}
        <AnimatePresence mode="wait">
          {activeTab === "subscriptions" && services.length > 1 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-1.5"
            >
              <label className="text-xs font-medium text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" /> Service
              </label>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
                <button
                  onClick={() => setSelectedService("All")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                    selectedService === "All"
                      ? "bg-accent/20 text-accent border border-accent/30"
                      : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                  )}
                >
                  All Services
                </button>
                {services.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedService(s)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                      selectedService === s
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
        {genres.length > 1 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-tertiary uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Genre
            </label>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              <button
                onClick={() => setSelectedGenre("All")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                  selectedGenre === "All"
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                )}
              >
                All Genres
              </button>
              {genres.map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGenre(g)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                    selectedGenre === g
                      ? "bg-accent/20 text-accent border border-accent/30"
                      : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Count */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-tertiary">
            {isLoading
              ? "Loading games…"
              : `${filteredCount} game${filteredCount !== 1 ? "s" : ""} found`}
          </span>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : filteredCount === 0 ? (
        <div className="py-16 text-center">
          <Gamepad2 className="w-12 h-12 text-tertiary mx-auto mb-3" />
          <p className="text-secondary">
            {activeTab === "free" ? "No free games match your filters." : "No subscription games match your filters."}
          </p>
          <button
            onClick={() => { setSelectedGenre("All"); setSelectedService("All"); }}
            className="mt-3 text-xs text-accent hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {activeTab === "free"
            ? filteredFree.map((game, i) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.5), duration: 0.4 }}
                >
                  <FreeGameCard game={game} priority={i < 5} />
                </motion.div>
              ))
            : filteredSubs.map((game, i) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.5), duration: 0.4 }}
                >
                  <SubscriptionGameCard game={game} priority={i < 5} />
                </motion.div>
              ))}
        </div>
      )}

      {/* Attribution */}
      <p className="text-center text-[10px] text-tertiary pt-4">
        Game data powered by <a href="https://gxcorner.games" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">GX Corner</a>
      </p>
    </div>
  );
}
