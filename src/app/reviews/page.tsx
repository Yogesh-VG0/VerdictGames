"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getGlobalReviews } from "@/lib/api";
import ReviewCard from "@/components/ReviewCard";
import FilterChips from "@/components/ui/FilterChips";
import SortDropdown from "@/components/ui/SortDropdown";
import { ReviewCardSkeleton } from "@/components/ui/Skeleton";
import type { Platform } from "@/lib/types";

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
          Latest verdicts from the community on PC and Android games.
        </p>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 border-b border-white/[0.06] pb-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
            Platform
          </label>
          <FilterChips
            options={["All", "PC", "Android"] as ("All" | Platform)[]}
            selected={platform}
            onChange={setPlatform}
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
          <div className="text-center py-16 space-y-3">
            <div className="text-4xl">📝</div>
            <p className="text-foreground font-semibold">No reviews yet</p>
            <p className="text-sm text-secondary">
              Be the first to share your verdict.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
