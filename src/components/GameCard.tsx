"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Game } from "@/lib/types";
import { scoreColor, cn } from "@/lib/utils";
import PixelBadge from "@/components/ui/PixelBadge";
import VerdictBadge from "@/components/ui/VerdictBadge";

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
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative rounded-sm border border-border bg-surface overflow-hidden card-shimmer h-full hover:border-accent/50 transition-[border-color] duration-300"
        >
          {/* Cover image - taller for spotlight */}
          <div className="relative aspect-[3/4] overflow-hidden">
            <Image
              src={game.coverImage}
              alt={game.title}
              fill
              sizes="(max-width: 640px) 100vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              priority={priority}
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
            {/* Score badge with glow */}
            <div
              className={cn(
                "absolute top-3 right-3 w-12 h-12 rounded-sm flex items-center justify-center",
                "bg-background/85 backdrop-blur-md border border-border text-sm font-bold tabular-nums",
                scoreColor(game.score),
                "group-hover:" + scoreGlowClass(game.score),
                "transition-shadow duration-300"
              )}
            >
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
                <span className="text-[10px] text-tertiary font-medium ml-auto">
                  {yearFromDate(game.releaseDate)}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-foreground leading-tight line-clamp-2 group-hover:text-accent transition-colors">
              {game.title}
            </h3>
            <VerdictBadge label={game.verdictLabel} size="sm" />
            {game.verdictSummary && (
              <p className="text-xs text-secondary line-clamp-2 leading-relaxed">
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
        whileHover={{ y: -6, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative rounded-sm border border-border bg-surface overflow-hidden pixel-corners card-shimmer h-full hover:border-border-hover hover:shadow-lg hover:shadow-accent/5 transition-[border-color,box-shadow] duration-300"
      >
        {/* Cover image */}
        <div className="relative aspect-[5/7] overflow-hidden">
          <Image
            src={game.coverImage}
            alt={game.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority={priority}
          />

          {/* Hover gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Score overlay */}
          <div
            className={cn(
              "absolute top-2 right-2 w-9 h-9 rounded-sm flex items-center justify-center",
              "bg-background/80 backdrop-blur-sm border border-border text-xs font-bold tabular-nums",
              scoreColor(game.score),
              "transition-shadow duration-300"
            )}
          >
            {game.score}
          </div>

          {/* Platform badges */}
          <div className="absolute bottom-2 left-2 flex gap-1">
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
            <div className="absolute top-2 left-2">
              <span className="text-[9px] text-white/70 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-sm font-medium">
                {yearFromDate(game.releaseDate)}
              </span>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-3 space-y-1.5">
          <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-accent transition-colors">
            {game.title}
          </h3>

          <div className="flex items-center gap-2">
            <VerdictBadge label={game.verdictLabel} size="sm" />
          </div>

          <div className="flex flex-wrap gap-1 pt-0.5">
            {game.genres.slice(0, 2).map((g) => (
              <span
                key={g}
                className="text-[10px] text-tertiary font-medium uppercase tracking-wide"
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
