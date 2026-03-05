"use client";

import Image from "next/image";
import Link from "next/link";
import { Review } from "@/lib/types";
import { scoreColor, formatDate, cn } from "@/lib/utils";

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
            className="shrink-0 relative w-10 h-14 rounded-lg overflow-hidden border border-white/[0.08]"
          >
            <Image
              src={review.gameCover}
              alt={review.gameTitle}
              fill
              sizes="40px"
              className="object-cover"
            />
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
          <div className="flex items-center gap-2 text-xs text-secondary">
            <Link
              href={`/profile/${review.username}`}
              className="hover:text-accent transition-colors font-medium"
            >
              {review.username}
            </Link>
            <span className="text-tertiary">·</span>
            <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
            <span className="text-tertiary">·</span>
            <span className="uppercase text-[10px] tracking-wider">{review.platform}</span>
          </div>
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
