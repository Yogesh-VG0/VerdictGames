"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getGlobalReviews, getTopRated } from "@/lib/api";
import ReviewCard from "@/components/ReviewCard";
import FilterChips from "@/components/ui/FilterChips";
import SortDropdown from "@/components/ui/SortDropdown";
import { ReviewCardSkeleton } from "@/components/ui/Skeleton";
import type { Platform } from "@/lib/types";
import { PLATFORM_FILTER_OPTIONS, platformFilterIcon } from "@/components/ui/PlatformIcon";
import { PenLine, Star } from "lucide-react";

const listItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

export default function ReviewsPage() {
  const [sort, setSort] = useState<"newest" | "helpful">("newest");
  const [platform, setPlatform] = useState<"All" | Platform>("All");

  const { data, isLoading } = useQuery({
    queryKey: ["globalReviews", sort, platform],
    queryFn: () =>
      getGlobalReviews({
        sort,
        platform: platform === "All" ? "All" : platform,
      }),
  });

  const { data: topGames } = useQuery({
    queryKey: ["topRatedPicks"],
    queryFn: () => getTopRated(6),
    enabled: !isLoading && (!data || data.items.length === 0),
    staleTime: 60_000,
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-1"
      >
        <h1 className="text-2xl font-bold text-foreground">Community Reviews</h1>
        <p className="text-sm text-secondary">
          Latest verdicts from the community across all platforms.
        </p>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
            Platform
          </label>
          <FilterChips
            options={PLATFORM_FILTER_OPTIONS.map((o) => o.value)}
            selected={platform}
            onChange={setPlatform}
            labelFn={(v) => PLATFORM_FILTER_OPTIONS.find((o) => o.value === v)?.label ?? v}
            iconFn={(v) => platformFilterIcon(v)}
          />
        </div>
        <div className="space-y-1 ml-auto">
          <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
            Sort
          </label>
          <SortDropdown
            options={[
              { label: "Newest First", value: "newest" as const },
              { label: "Most Helpful", value: "helpful" as const },
            ]}
            selected={sort}
            onChange={setSort}
          />
        </div>
      </div>

      {/* Reviews list */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
        className="space-y-4"
      >
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <ReviewCardSkeleton key={i} />
          ))
        ) : data && data.items.length > 0 ? (
          data.items.map((review) => (
            <motion.div key={review.id} variants={listItem}>
              <ReviewCard review={review} />
            </motion.div>
          ))
        ) : (
          <div className="space-y-8">
            {/* Enhanced empty state */}
            <div className="text-center py-10 space-y-4 rounded-2xl border border-border bg-surface">
              <PenLine className="w-10 h-10 text-accent mx-auto" />
              <h2 className="text-xl font-bold text-foreground">Be the First to Share Your Verdict</h2>
              <p className="text-sm text-secondary max-w-lg mx-auto leading-relaxed">
                Our community reviews section is brand new. Your review could be the first one others read when deciding what to play next.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                <Link
                  href="/search?sort=trending"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
                >
                  Review a Trending Game
                </Link>
                <Link
                  href="/search?sort=top-rated"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-accent border border-accent/30 rounded-xl hover:bg-accent/10 transition-colors"
                >
                  Browse Top Rated
                </Link>
              </div>
            </div>

            {/* Dynamic top-rated games as review suggestions */}
            {topGames && topGames.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Star className="w-4 h-4 text-accent" />
                  Top Rated — Games Worth Reviewing
                </h3>
                <p className="text-xs text-tertiary">
                  These highly-rated games are waiting for community verdicts. Pick one and share your thoughts!
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {topGames.map((game) => (
                    <Link
                      key={game.slug}
                      href={`/game/${game.slug}`}
                      className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-3 hover:border-accent/30 hover:bg-surface-2 transition-all"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold shrink-0 ${
                        game.score >= 90 ? "bg-score-great/10 text-score-great" : "bg-score-good/10 text-score-good"
                      }`}>
                        {game.score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors truncate">
                          {game.title}
                        </p>
                        <p className="text-[10px] text-tertiary">{game.genres?.[0] ?? ""}</p>
                      </div>
                      <span className="text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        Review →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
