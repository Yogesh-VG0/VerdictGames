"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getLibrary, getLibraryStats, updateLibraryGame, removeFromLibrary } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import AuthModal from "@/components/AuthModal";
import GameCard from "@/components/GameCard";
import FadeInSection from "@/components/FadeInSection";
import SectionHeader from "@/components/SectionHeader";
import { cn } from "@/lib/utils";
import type { LibraryStatus } from "@/lib/types";
import {
  BookOpen, Gamepad2, CheckCircle2, Star, Pause, XCircle,
} from "lucide-react";
import type { ReactNode } from "react";

const STATUS_TABS: { key: string; label: string; icon: ReactNode }[] = [
  { key: "all", label: "All", icon: <BookOpen className="w-3.5 h-3.5" /> },
  { key: "playing", label: "Playing", icon: <Gamepad2 className="w-3.5 h-3.5" /> },
  { key: "completed", label: "Completed", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { key: "wishlist", label: "Wishlist", icon: <Star className="w-3.5 h-3.5" /> },
  { key: "paused", label: "Paused", icon: <Pause className="w-3.5 h-3.5" /> },
  { key: "dropped", label: "Dropped", icon: <XCircle className="w-3.5 h-3.5" /> },
];

function LibraryContent() {
  const { user, hasSession, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [authOpen, setAuthOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const queryClient = useQueryClient();

  // Read status from URL params (e.g. /library?status=wishlist from toast link)
  useEffect(() => {
    const urlStatus = searchParams.get("status");
    if (urlStatus && STATUS_TABS.some(t => t.key === urlStatus)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(urlStatus);
    }
  }, [searchParams]);

  const library = useQuery({
    queryKey: ["library", activeTab, user?.id ?? null],
    queryFn: () => getLibrary(activeTab === "all" ? undefined : activeTab),
    enabled: !!user,
  });

  const stats = useQuery({
    queryKey: ["libraryStats", user?.id ?? null],
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

  if (authLoading) return <p role="status" className="py-16 text-center text-secondary">Loading your library…</p>;
  if (!user && hasSession) return <div role="alert" className="px-4 py-16 text-center space-y-4">
    <h1 className="text-2xl font-bold">Your library is temporarily unavailable</h1>
    <p className="text-sm text-secondary">Your session is active, but we couldn&apos;t load your profile. Please try again.</p>
    <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-action text-action-foreground px-5 py-2.5">Try again</button>
  </div>;

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4 px-4">
        <BookOpen className="w-12 h-12 text-accent mx-auto" />
        <h1 className="text-2xl font-bold text-foreground">Your Game Library</h1>
        <p className="text-sm text-secondary max-w-md">
          Track what you&apos;re playing, build your backlog, and never forget a great game.
        </p>
        <button
          onClick={() => setAuthOpen(true)}
          className="px-6 py-2.5 rounded-xl bg-action text-action-foreground text-sm font-semibold hover:bg-action-hover transition-colors"
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
          <SectionHeader title="My Library" icon={<BookOpen className="w-5 h-5" />} subtitle="Track your gaming journey" gradient="linear-gradient(90deg, #8b5cf6 0%, #a78bfa 25%, #c4b5fd 50%, #a78bfa 75%, #8b5cf6 100%)" />

          {stats.isError ? (
            <p role="alert" className="text-sm text-secondary">
              Library statistics are temporarily unavailable.{" "}
              <button type="button" onClick={() => void stats.refetch()} className="text-accent underline">Try again</button>
            </p>
          ) : stats.data && (
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
                  className="rounded-xl border border-border bg-surface p-3 text-center"
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
                ? "bg-action text-action-foreground"
                : "bg-surface-2 text-secondary hover:text-foreground hover:bg-elevated border border-border"
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
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          exit={undefined}
          transition={{ duration: 0.2 }}
        >
          {library.isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-2xl bg-surface animate-pulse" />
              ))}
            </div>
          ) : library.isError ? (
            <div role="alert" className="text-center py-16 space-y-3">
              <p className="text-secondary font-medium">Your library could not be loaded.</p>
              <button type="button" onClick={() => void library.refetch()} className="rounded-xl bg-action text-action-foreground px-5 py-2.5">Try again</button>
            </div>
          ) : library.data && library.data.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {library.data.map((item, index) => (
                <div key={item.id} className="flex min-w-0 flex-col gap-2">
                  {item.game && <GameCard game={item.game} priority={index < 4} />}

                  <div className="mt-auto flex items-center gap-1.5">
                    <select
                      id={`library-status-${item.gameId}`}
                      name="status"
                      value={item.status}
                      onChange={(e) => statusMutation.mutate({ gameId: item.gameId, status: e.target.value as LibraryStatus })}
                      aria-label={`Update library status for ${item.game?.title ?? "game"}`}
                      className="min-h-8 min-w-0 flex-1 cursor-pointer rounded-lg border border-border bg-surface px-1.5 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <option value="playing">Playing</option>
                      <option value="completed">Completed</option>
                      <option value="wishlist">Wishlist</option>
                      <option value="paused">Paused</option>
                      <option value="dropped">Dropped</option>
                    </select>
                    {item.personalRating !== undefined && (
                      <span className="shrink-0 text-xs font-bold text-accent" aria-label={`Your rating: ${item.personalRating}`}>
                        {item.personalRating}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(item.gameId)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-secondary transition-colors hover:text-danger focus-visible:outline-2 focus-visible:outline-accent"
                      aria-label={`Remove ${item.game?.title ?? "game"} from library`}
                      title="Remove from library"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 space-y-3">
              <Gamepad2 className="w-10 h-10 text-accent mx-auto" />
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

export default function LibraryPage() {
  return (
    <Suspense fallback={
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-surface animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <LibraryContent />
    </Suspense>
  );
}
