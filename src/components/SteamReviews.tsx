"use client";

import { useQuery } from "@tanstack/react-query";
import { getSteamReviews, type SteamPlayerReview } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SteamReviewsProps {
  slug: string;
  className?: string;
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

      {/* Review text */}
      <p className="text-sm text-secondary leading-relaxed line-clamp-4">
        {review.reviewText}
      </p>

      {/* Footer: helpful count */}
      <div className="flex items-center gap-3 text-[10px] text-tertiary">
        {review.votesUp > 0 && (
          <span>{review.votesUp} found helpful</span>
        )}
        {review.authoredAt && (
          <span>{new Date(review.authoredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        )}
        {review.steamPurchase && (
          <span className="text-pixel-cyan/70">Steam Purchase</span>
        )}
      </div>
    </div>
  );
}

export default function SteamReviews({ slug, className }: SteamReviewsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["steam-reviews", slug],
    queryFn: () => getSteamReviews(slug, 3),
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

      {data.reviews.map((review) => (
        <ReviewCard key={review.recommendationId} review={review} />
      ))}

      <p className="text-[10px] text-tertiary pt-1">
        Reviews sourced from Steam. All reviews belong to their respective authors.
      </p>
    </div>
  );
}
