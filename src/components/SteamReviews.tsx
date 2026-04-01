"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSteamReviews, type SteamPlayerReview } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SteamReviewsProps {
  slug: string;
  className?: string;
  initialData?: Awaited<ReturnType<typeof getSteamReviews>>;
}

function formatPlaytime(minutes: number): string {
  const hours = Math.round(minutes / 60);
  if (hours < 1) return "<1h";
  if (hours >= 1000) return `${(hours / 1000).toFixed(1)}K hrs`;
  return `${hours} hrs`;
}

function ReviewCard({ review }: { review: SteamPlayerReview }) {
  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3 transition-colors",
      review.votedUp
        ? "border-pixel-green/20 bg-pixel-green/[0.03]"
        : "border-red-500/20 bg-red-500/[0.03]"
    )}>
      {/* Header: thumbs up/down + playtime */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-lg",
            review.votedUp ? "text-pixel-green" : "text-red-400"
          )}>
            {review.votedUp ? "👍" : "👎"}
          </span>
          <span className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            review.votedUp ? "text-pixel-green" : "text-red-400"
          )}>
            {review.votedUp ? "Recommended" : "Not Recommended"}
          </span>
        </div>
        <span className="text-[10px] text-tertiary font-medium">
          {formatPlaytime(review.playtimeAtReview)} at review
        </span>
      </div>

      {/* Review text — fixed height for consistent card sizing across pagination */}
      <p className="text-sm text-secondary leading-relaxed line-clamp-6 min-h-[8.5rem]">
        {review.reviewText}
      </p>

      {/* Footer: helpful count */}
      <div className="flex items-center gap-3 text-[10px] text-tertiary">
        {review.votesUp > 0 && (
          <span>{review.votesUp} found helpful</span>
        )}
        {review.authoredAt && (
          <span>{formatDate(review.authoredAt)}</span>
        )}
        {review.steamPurchase && (
          <span className="text-pixel-cyan/70">Steam Purchase</span>
        )}
      </div>
    </div>
  );
}

function NumberedPagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1.5 pt-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-1.5 rounded-lg border border-border text-secondary hover:text-foreground hover:bg-surface-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      {getPageNumbers().map((page, i) =>
        page === "..." ? (
          <span key={`ellipsis-${i}`} className="px-1 text-[11px] text-tertiary">…</span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={cn(
              "min-w-[28px] h-7 rounded-lg text-[11px] font-medium transition-colors",
              page === currentPage
                ? "bg-accent text-white"
                : "text-secondary hover:text-foreground hover:bg-surface-2 border border-border"
            )}
          >
            {page}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-1.5 rounded-lg border border-border text-secondary hover:text-foreground hover:bg-surface-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

const REVIEWS_PER_PAGE = 3;

export default function SteamReviews({ slug, className, initialData }: SteamReviewsProps) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["steam-reviews", slug],
    queryFn: () => getSteamReviews(slug, 21),
    initialData,
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-bold text-foreground">Steam Player Reviews</h3>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-surface-2 p-4 h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.reviews.length === 0) return null;

  const steamUrl = data.steamAppId
    ? `https://store.steampowered.com/app/${data.steamAppId}#app_reviews_hash`
    : null;

  const totalPages = Math.ceil(data.reviews.length / REVIEWS_PER_PAGE);
  const pageReviews = data.reviews.slice((page - 1) * REVIEWS_PER_PAGE, page * REVIEWS_PER_PAGE);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-pixel-cyan" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <h3 className="text-lg font-bold text-foreground">Steam Player Reviews</h3>
          <span className="text-xs text-tertiary">({data.total} total)</span>
        </div>
        {steamUrl && (
          <a
            href={steamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-pixel-cyan hover:text-pixel-cyan/80 transition-colors font-medium"
          >
            View on Steam →
          </a>
        )}
      </div>

      {/* Always render REVIEWS_PER_PAGE slots to prevent container height changes */}
      <div className="space-y-3">
        {Array.from({ length: REVIEWS_PER_PAGE }).map((_, i) => {
          const review = pageReviews[i];
          if (review) return <ReviewCard key={review.recommendationId} review={review} />;
          // Invisible spacer matching card height so container never shrinks
          return <div key={`spacer-${i}`} className="rounded-xl border border-transparent p-4 space-y-3 invisible"><p className="text-sm leading-relaxed min-h-[8.5rem]" /></div>;
        })}
      </div>

      <NumberedPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      <p className="text-[10px] text-tertiary pt-1">
        Reviews sourced from Steam. All reviews belong to their respective authors.
      </p>
    </div>
  );
}
