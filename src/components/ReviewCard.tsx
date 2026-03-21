"use client";

import Image from "next/image";
import Link from "next/link";
import { Review } from "@/lib/types";
import { scoreColor, formatDate, cn } from "@/lib/utils";
import PlatformIcon from "@/components/ui/PlatformIcon";

interface ReviewCardProps {
  review: Review;
  showGame?: boolean;
  className?: string;
}

export default function ReviewCard({
  review,
  showGame = true,
  className,
}: ReviewCardProps) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-surface p-4 space-y-3",
        "hover:border-white/[0.15] hover:shadow-lg hover:shadow-accent/5 transition-all duration-300",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Game cover (optional) */}
        {showGame && (
          <Link
            href={`/game/${review.gameSlug}`}
            className="shrink-0 relative w-16 h-20 sm:w-20 sm:h-28 rounded-xl overflow-hidden border border-border bg-surface-2 group/cover"
          >
            {review.gameCover ? (
              <Image
                src={review.gameCover}
                alt={review.gameTitle}
                fill
                sizes="80px"
                className="object-cover group-hover/cover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-tertiary">🎮</div>
            )}
          </Link>
        )}

        {/* User info */}
        <div className="flex-1 min-w-0">
          {showGame && (
            <Link
              href={`/game/${review.gameSlug}`}
              className="text-sm font-semibold text-foreground hover:text-accent transition-colors line-clamp-1"
            >
              {review.gameTitle}
            </Link>
          )}
          <div className="flex items-center gap-2 text-xs text-secondary flex-wrap">
            <Link
              href={`/profile/${review.username}`}
              className="hover:text-accent transition-colors font-medium"
            >
              {review.username}
            </Link>
            <span className="text-tertiary">·</span>
            <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
            <span className="text-tertiary">·</span>
            <span className="inline-flex items-center gap-1">
              <PlatformIcon platform={review.platform} size={12} />
              <span className="text-[10px] tracking-wider">{review.platform}</span>
            </span>
          </div>
          {/* Quick link to game page */}
          {showGame && (
            <Link
              href={`/game/${review.gameSlug}`}
              className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-accent hover:text-accent-hover transition-colors font-medium"
            >
              View game page →
            </Link>
          )}
        </div>

        {/* Score */}
        <div
          className={cn(
            "shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
            "border-2 text-sm font-bold tabular-nums",
            scoreColor(review.rating),
            review.rating >= 75
              ? "border-score-great/40"
              : review.rating >= 50
                ? "border-score-mixed/40"
                : "border-score-bad/40"
          )}
        >
          {review.rating}
        </div>
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-foreground leading-snug">
        {review.title}
      </h4>

      {/* Body */}
      <p className="text-sm text-secondary leading-relaxed line-clamp-4">
        {review.body}
      </p>

      {/* Pros / Cons (if available) */}
      {(review.pros || review.cons) && (
        <div className="flex flex-col sm:flex-row gap-3 text-xs">
          {review.pros && review.pros.length > 0 && (
            <div className="flex-1">
              {review.pros.map((pro, i) => (
                <div key={i} className="flex items-start gap-1.5 text-success">
                  <span className="mt-0.5">+</span>
                  <span className="text-secondary">{pro}</span>
                </div>
              ))}
            </div>
          )}
          {review.cons && review.cons.length > 0 && (
            <div className="flex-1">
              {review.cons.map((con, i) => (
                <div key={i} className="flex items-start gap-1.5 text-danger">
                  <span className="mt-0.5">−</span>
                  <span className="text-secondary">{con}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 pt-1 text-xs text-tertiary">
        <span>▲ {review.helpful} found helpful</span>
      </div>
    </article>
  );
}
