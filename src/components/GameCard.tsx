"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Game } from "@/lib/types";
import { scoreColor, cn } from "@/lib/utils";
import PixelBadge from "@/components/ui/PixelBadge";
import VerdictBadge from "@/components/ui/VerdictBadge";
import ScoreChips from "@/components/ScoreChips";

interface GameCardProps {
  game: Game;
  priority?: boolean;
  className?: string;
  /** "spotlight" renders a larger card with description */
  variant?: "default" | "spotlight";
}

function scoreGlowClass(score: number) {
  if (score >= 80) return "score-glow-great";
  if (score >= 65) return "score-glow-good";
  if (score >= 45) return "score-glow-mixed";
  return "score-glow-bad";
}

function yearFromDate(date: string | undefined): string | null {
  if (!date) return null;
  const y = new Date(date).getFullYear();
  return isNaN(y) ? null : String(y);
}

export default function GameCard({
  game,
  priority = false,
  className,
  variant = "default",
}: GameCardProps) {
  if (variant === "spotlight") {
    return (
      <Link href={`/game/${game.slug}`} className={cn("block group", className)}>
        <motion.article
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative rounded-2xl border border-white/[0.08] bg-surface overflow-hidden card-shimmer h-full hover:border-purple-500/30 hover:shadow-[0_0_40px_-8px_rgba(168,85,247,0.25)] transition-all duration-500"
        >
          {/* Cover image - taller for spotlight */}
          <div className="relative aspect-[3/4] overflow-hidden">
            <Image
              src={game.coverImage}
              alt={game.title}
              fill
              sizes="(max-width: 640px) 100vw, 33vw"
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              priority={priority}
            />
            {/* Gradient overlay — always dark */}
            <div className="absolute inset-0 card-image-gradient" />
            {/* Verdict score badge */}
            <div
              className={cn(
                "absolute top-3 right-3 rounded-xl px-2.5 py-1 flex items-center gap-1.5",
                "bg-black/60 backdrop-blur-md border border-white/10 text-sm font-bold tabular-nums",
                scoreColor(game.score),
                "group-hover:" + scoreGlowClass(game.score),
                "transition-all duration-300"
              )}
              title={`Verdict Score: ${game.score} (source: ${game.scoreSource ?? "blended"})`}
            >
              <span className="text-[9px] opacity-50 font-medium">V</span>
              {game.score}
            </div>
          </div>

          {/* Content overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              {game.platforms.map((p) => (
                <PixelBadge key={p} variant={p === "PC" ? "accent" : "success"} size="sm">
                  {p}
                </PixelBadge>
              ))}
              {yearFromDate(game.releaseDate) && (
                <span className="text-[10px] text-white/50 font-medium ml-auto">
                  {yearFromDate(game.releaseDate)}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white leading-tight line-clamp-2 group-hover:text-accent transition-colors drop-shadow-md">
              {game.title}
            </h3>
            <VerdictBadge label={game.verdictLabel} size="sm" />
            <ScoreChips game={game} variant="compact" />
            {game.verdictSummary && (
              <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">
                {game.verdictSummary}
              </p>
            )}
          </div>
        </motion.article>
      </Link>
    );
  }

  return (
    <Link href={`/game/${game.slug}`} className={cn("block group", className)}>
      <motion.article
        whileHover={{ y: -6 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative rounded-2xl border border-white/[0.08] bg-surface overflow-hidden card-shimmer h-full hover:border-purple-500/20 hover:shadow-[0_0_30px_-8px_rgba(168,85,247,0.2)] transition-all duration-500"
      >
        {/* Cover image */}
        <div className="relative aspect-[3/4] overflow-hidden">
          <Image
            src={game.coverImage}
            alt={game.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            priority={priority}
          />

          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />

          {/* Score overlay */}
          <div
            className={cn(
              "absolute top-2.5 right-2.5 rounded-xl px-2 py-1 flex items-center gap-1",
              "bg-black/60 backdrop-blur-md border border-white/10 text-xs font-bold tabular-nums",
              scoreColor(game.score),
              "transition-all duration-300"
            )}
            title={`Verdict ${game.score} (${game.scoreSource ?? "blended"})`}
          >
            <span className="text-[8px] opacity-40">V</span>
            {game.score}
          </div>

          {/* Platform badges */}
          <div className="absolute bottom-2.5 left-2.5 flex gap-1.5">
            {game.platforms.map((p) => (
              <PixelBadge
                key={p}
                variant={p === "PC" ? "accent" : "success"}
                size="sm"
              >
                {p}
              </PixelBadge>
            ))}
          </div>

          {/* Year badge */}
          {yearFromDate(game.releaseDate) && (
            <div className="absolute top-2.5 left-2.5">
              <span className="text-[10px] text-white/70 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-lg font-medium border border-white/5">
                {yearFromDate(game.releaseDate)}
              </span>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-3.5 space-y-2">
          <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-accent transition-colors">
            {game.title}
          </h3>

          <div className="flex items-center gap-2">
            <VerdictBadge label={game.verdictLabel} size="sm" />
          </div>

          <ScoreChips game={game} variant="compact" />

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {game.genres.slice(0, 2).map((g) => (
              <span
                key={g}
                className="text-[10px] text-tertiary font-medium"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      </motion.article>
    </Link>
  );
}
