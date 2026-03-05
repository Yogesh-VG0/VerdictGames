"use client";

import { Game } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ScoreChipsProps {
  game: Game;
  /** "compact" for cards, "full" for hero/detail pages */
  variant?: "compact" | "full";
  className?: string;
}

/** Source-specific chip styling */
const chipStyles: Record<string, { bg: string; icon: string; label: string }> = {
  steam: { bg: "bg-[#1b2838]/80 text-[#66c0f4]", icon: "🎮", label: "Steam" },
  igdb: { bg: "bg-purple-950/60 text-purple-300", icon: "📊", label: "IGDB" },
  metacritic: { bg: "bg-yellow-950/60 text-yellow-300", icon: "🏅", label: "MC" },
};

function formatReviewCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}K`;
  return String(count);
}

/**
 * Multi-source score chips — shows available scores from
 * Steam, IGDB, and Metacritic as separate labeled badges.
 * Only shows chips for scores that actually exist.
 */
export default function ScoreChips({
  game,
  variant = "compact",
  className,
}: ScoreChipsProps) {
  const chips: { source: string; value: string; detail?: string }[] = [];

  // Steam review %
  if (game.userScore != null) {
    const detail =
      variant === "full" && game.steamRatingLabel
        ? `${game.steamRatingLabel} (${formatReviewCount(game.reviewCount)})`
        : game.reviewCount > 0
        ? formatReviewCount(game.reviewCount)
        : undefined;
    chips.push({ source: "steam", value: `${game.userScore}%`, detail });
  }

  // IGDB rating
  if (game.igdbRating != null) {
    chips.push({ source: "igdb", value: String(Math.round(game.igdbRating)) });
  }

  // Metacritic (via RAWG)
  if (game.rawgMetacritic != null) {
    chips.push({ source: "metacritic", value: String(game.rawgMetacritic) });
  }

  // Nothing to show? Fall back to showing the Verdict score with source label
  if (chips.length === 0) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-accent/15 text-accent border border-accent/20">
          Verdict {game.score}
        </span>
      </div>
    );
  }

  const isCompact = variant === "compact";

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {chips.map(({ source, value, detail }) => {
        const style = chipStyles[source] ?? chipStyles.steam;
        return (
          <span
            key={source}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-white/10 font-bold tabular-nums",
              style.bg,
              isCompact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
            )}
            title={
              detail
                ? `${style.label}: ${value} — ${detail}`
                : `${style.label}: ${value}`
            }
          >
            {!isCompact && <span className="opacity-70">{style.icon}</span>}
            <span className="opacity-70">{style.label}</span>
            <span>{value}</span>
            {!isCompact && detail && (
              <span className="opacity-60 font-normal ml-0.5">{detail}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
