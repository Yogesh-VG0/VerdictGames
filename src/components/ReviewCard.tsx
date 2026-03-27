"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Review } from "@/lib/types";
import { scoreColor, formatDate, cn } from "@/lib/utils";
import { voteOnReview } from "@/lib/api";
import PlatformIcon from "@/components/ui/PlatformIcon";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface ReviewCardProps {
  review: Review;
  showGame?: boolean;
  className?: string;
  onAuthRequired?: () => void;
}

export default function ReviewCard({
  review,
  showGame = true,
  className,
  onAuthRequired,
}: ReviewCardProps) {
  const [helpful, setHelpful] = useState(review.helpful);
  const [notHelpful, setNotHelpful] = useState(review.notHelpful);
  const [userVote, setUserVote] = useState<-1 | 0 | 1>(review.userVote);
  const [voting, setVoting] = useState(false);

  const handleVote = useCallback(
    async (value: 1 | -1) => {
      if (voting) return;

      // Check auth — if onAuthRequired is provided, caller handles unauthed state
      // The API will return 401 which we handle below

      // Optimistic update
      const prevHelpful = helpful;
      const prevNotHelpful = notHelpful;
      const prevVote = userVote;

      if (userVote === value) {
        // Toggle off
        setUserVote(0);
        if (value === 1) setHelpful((h) => Math.max(0, h - 1));
        else setNotHelpful((h) => Math.max(0, h - 1));
      } else {
        // New vote or change direction
        if (userVote === 1) setHelpful((h) => Math.max(0, h - 1));
        else if (userVote === -1) setNotHelpful((h) => Math.max(0, h - 1));
        setUserVote(value);
        if (value === 1) setHelpful((h) => h + 1);
        else setNotHelpful((h) => h + 1);
      }

      setVoting(true);
      try {
        const result = await voteOnReview(review.id, value);
        if (result) {
          // Sync with server truth
          setHelpful(result.helpful);
          setNotHelpful(result.notHelpful);
          setUserVote(
            result.userVote === 1 ? 1 : result.userVote === -1 ? -1 : 0
          );
        } else {
          // API returned null — likely 401 (not authenticated)
          setHelpful(prevHelpful);
          setNotHelpful(prevNotHelpful);
          setUserVote(prevVote);
          onAuthRequired?.();
        }
      } catch {
        // Revert on error
        setHelpful(prevHelpful);
        setNotHelpful(prevNotHelpful);
        setUserVote(prevVote);
      } finally {
        setVoting(false);
      }
    },
    [voting, userVote, helpful, notHelpful, review.id, onAuthRequired]
  );

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
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={review.gameCover}
                alt={review.gameTitle}
                className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-300"
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
              {review.displayName || review.username}
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

      {/* Footer — Voting buttons */}
      <div className="flex items-center gap-1.5 pt-1">
        {/* Helpful button */}
        <button
          onClick={() => handleVote(1)}
          disabled={voting}
          aria-label="Mark as helpful"
          aria-pressed={userVote === 1}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border",
            userVote === 1
              ? "bg-score-great/15 text-score-great border-score-great/30 shadow-sm"
              : "text-tertiary border-transparent hover:text-score-great hover:bg-score-great/10 hover:border-score-great/20",
            voting && "opacity-50 cursor-not-allowed"
          )}
        >
          <ThumbsUp className={cn("w-3.5 h-3.5", userVote === 1 && "fill-current")} />
          <span className="tabular-nums">{helpful}</span>
        </button>

        {/* Not Helpful button */}
        <button
          onClick={() => handleVote(-1)}
          disabled={voting}
          aria-label="Mark as not helpful"
          aria-pressed={userVote === -1}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border",
            userVote === -1
              ? "bg-score-bad/15 text-score-bad border-score-bad/30 shadow-sm"
              : "text-tertiary border-transparent hover:text-score-bad hover:bg-score-bad/10 hover:border-score-bad/20",
            voting && "opacity-50 cursor-not-allowed"
          )}
        >
          <ThumbsDown className={cn("w-3.5 h-3.5", userVote === -1 && "fill-current")} />
          {notHelpful > 0 && <span className="tabular-nums">{notHelpful}</span>}
        </button>

        <span className="text-[10px] text-tertiary ml-1">
          {helpful > 0 ? `${helpful} found helpful` : "Was this helpful?"}
        </span>
      </div>
    </article>
  );
}
