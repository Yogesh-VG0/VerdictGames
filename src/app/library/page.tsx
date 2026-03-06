"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { getLibrary, getLibraryStats, updateLibraryGame, removeFromLibrary } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import AuthModal from "@/components/AuthModal";
import GameCard from "@/components/GameCard";
import FadeInSection from "@/components/FadeInSection";
import SectionHeader from "@/components/SectionHeader";
import { cn } from "@/lib/utils";
import type { LibraryStatus } from "@/lib/types";

const STATUS_TABS: { key: string; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "📚" },
  { key: "playing", label: "Playing", icon: "🎮" },
  { key: "completed", label: "Completed", icon: "✅" },
  { key: "wishlist", label: "Wishlist", icon: "⭐" },
  { key: "paused", label: "Paused", icon: "⏸️" },
  { key: "dropped", label: "Dropped", icon: "❌" },
];

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const queryClient = useQueryClient();

  const library = useQuery({
    queryKey: ["library", activeTab],
    queryFn: () => getLibrary(activeTab === "all" ? undefined : activeTab),
    enabled: !!user,
  });

  const stats = useQuery({
    queryKey: ["libraryStats"],
    queryFn: getLibraryStats,
    enabled: !!user,
  });

  const removeMutation = useMutation({
    mutationFn: (gameId: string) => removeFromLibrary(gameId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
      queryClient.invalidateQueries({ queryKey: ["libraryStats"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ gameId, status }: { gameId: string; status: LibraryStatus }) =>
      updateLibraryGame({ gameId, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
      queryClient.invalidateQueries({ queryKey: ["libraryStats"] });
    },
  });

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4 px-4">
        <div className="text-5xl">📚</div>
        <h2 className="text-xl font-bold text-foreground">Your Game Library</h2>
        <p className="text-sm text-secondary max-w-md">
          Track what you&apos;re playing, build your backlog, and never forget a great game.
        </p>
        <button
          onClick={() => setAuthOpen(true)}
          className="px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
        >
          Sign In to Get Started
        </button>
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} message="Sign in to start tracking your games" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 page-enter">
      {/* Header + Stats */}
      <FadeInSection>
        <div className="space-y-4">
          <SectionHeader title="My Library" icon="📚" subtitle="Track your gaming journey" />

          {stats.data && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {([
                { label: "Total", value: stats.data.total, color: "text-foreground" },
                { label: "Playing", value: stats.data.playing, color: "text-accent" },
                { label: "Completed", value: stats.data.completed, color: "text-score-great" },
                { label: "Wishlist", value: stats.data.wishlist, color: "text-warning" },
                { label: "Hours", value: Math.round(stats.data.totalHours), color: "text-score-good" },
                { label: "Avg Rating", value: stats.data.averageRating || "—", color: "text-score-good" },
              ]).map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/[0.08] bg-surface p-3 text-center"
                >
                  <p className={cn("text-xl font-bold tabular-nums", stat.color)}>{stat.value}</p>
                  <p className="text-[10px] text-tertiary uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </FadeInSection>

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
              activeTab === tab.key
                ? "bg-accent text-white"
                : "bg-white/5 text-secondary hover:text-foreground hover:bg-white/10"
            )}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Library grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {library.isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-2xl bg-surface animate-pulse" />
              ))}
            </div>
          ) : library.data && library.data.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {library.data.map((item) => (
                <div key={item.id} className="relative group">
                  {item.game && <GameCard game={item.game} />}

                  {/* Status overlay */}
                  <div className="absolute top-2 left-2 z-10">
                    <select
                      value={item.status}
                      onChange={(e) => statusMutation.mutate({ gameId: item.gameId, status: e.target.value as LibraryStatus })}
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-white border border-white/20 cursor-pointer"
                    >
                      <option value="playing">🎮 Playing</option>
                      <option value="completed">✅ Completed</option>
                      <option value="wishlist">⭐ Wishlist</option>
                      <option value="paused">⏸️ Paused</option>
                      <option value="dropped">❌ Dropped</option>
                    </select>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => removeMutation.mutate(item.gameId)}
                    className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-black/70 backdrop-blur-sm text-white/60 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove from library"
                  >
                    ×
                  </button>

                  {/* Personal rating */}
                  {item.personalRating !== undefined && (
                    <div className="absolute bottom-2 right-2 z-10 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-0.5">
                      <span className="text-xs font-bold text-accent">{item.personalRating}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 space-y-3">
              <div className="text-4xl">🎮</div>
              <p className="text-secondary font-medium">
                {activeTab === "all" ? "Your library is empty" : `No ${activeTab} games yet`}
              </p>
              <p className="text-tertiary text-sm">
                Browse games and add them to your library!
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
