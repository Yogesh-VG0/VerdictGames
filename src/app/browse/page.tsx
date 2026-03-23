"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import GameCard from "@/components/GameCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { Flame, Clock, Trophy, Calendar, Sparkles, TrendingUp } from "lucide-react";
import type { Game, PaginatedResponse } from "@/lib/types";

const TABS = [
  { id: "trending", label: "Trending", icon: Flame, desc: "Games gaining momentum right now" },
  { id: "newest", label: "New Releases", icon: Sparkles, desc: "The latest released games" },
  { id: "top-rated", label: "Top Rated", icon: Trophy, desc: "Highest-scoring games across all platforms" },
  { id: "upcoming", label: "Upcoming", icon: Calendar, desc: "Unreleased games arriving soon" },
  { id: "recently-added", label: "Recently Added", icon: Clock, desc: "Newest additions to our database" },
] as const;

type TabId = typeof TABS[number]["id"];

const PLATFORMS = ["All", "PC", "PlayStation", "Xbox", "Switch", "Android", "iOS", "Mac", "Linux"];
const CARD_CLASS = "w-full";

async function fetchBrowse(sort: string, platform: string, page: number): Promise<PaginatedResponse<Game>> {
  const params = new URLSearchParams({ sort, page: String(page), pageSize: "24" });
  if (platform && platform !== "All") params.set("platform", platform);
  const res = await fetch(`/api/search?${params}`);
  if (!res.ok) return { items: [], total: 0, page: 1, pageSize: 24, hasMore: false };
  const json = await res.json();
  return json.data ?? json;
}

function GameGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border overflow-hidden">
          <Skeleton className="aspect-[3/4] w-full" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BrowsePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (searchParams.get("sort") as TabId) || "trending";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [platform, setPlatform] = useState("All");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["browse", activeTab, platform, page],
    queryFn: () => fetchBrowse(activeTab, platform, page),
    staleTime: 60_000,
  });

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setPage(1);
    router.replace(`/browse?sort=${tab}`, { scroll: false });
  };

  const activeTabInfo = TABS.find((t) => t.id === activeTab);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
          <TrendingUp className="w-7 h-7 text-accent" />
          Browse Games
        </h1>
        <p className="text-sm text-secondary mt-1">
          Discover games by category across all platforms.
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

      {/* Platform filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => { setPlatform(p); setPage(1); }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
              platform === p
                ? "bg-accent/20 text-accent border border-accent/30"
                : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Section info */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">{activeTabInfo?.label}</h2>
          <p className="text-xs text-tertiary">{activeTabInfo?.desc}</p>
        </div>
        {data && (
          <span className="text-xs text-tertiary">
            {data.total.toLocaleString()} games
          </span>
        )}
      </div>

      {/* Game grid */}
      {isLoading ? (
        <GameGridSkeleton />
      ) : data && data.items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {data.items.map((game, i) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02, duration: 0.3 }}
              className={CARD_CLASS}
            >
              <GameCard game={game} priority={i < 6} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <p className="text-secondary">No games found for this category.</p>
        </div>
      )}

      {/* Pagination */}
      {data && (data.hasMore || page > 1) && (
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
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!data.hasMore}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-surface border border-border text-secondary hover:text-foreground hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
