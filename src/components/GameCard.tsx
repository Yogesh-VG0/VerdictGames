"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Game } from "@/lib/types";
import { scoreColor, cn } from "@/lib/utils";
import VerdictBadge from "@/components/ui/VerdictBadge";
import PlatformIcon from "@/components/ui/PlatformIcon";

interface GameCardProps {
  game: Game;
  priority?: boolean;
  className?: string;
  variant?: "default" | "spotlight";
}

function scoreGlowClass(score: number) {
  if (score >= 80) return "score-glow-great";
  if (score >= 65) return "score-glow-good";
  if (score >= 45) return "score-glow-mixed";
  return "score-glow-bad";
}

function BlurImage({ src, alt, sizes, priority, className }: {
  src: string; alt: string; sizes: string; priority?: boolean; className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <div className={cn(
        "absolute inset-0 bg-surface-2 transition-opacity duration-500",
        loaded ? "opacity-0" : "opacity-100"
      )} />
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={cn(
          "transition-all duration-700",
          loaded ? "opacity-100 scale-100" : "opacity-0 scale-105 blur-sm",
          className
        )}
        priority={priority}
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}

function yearFromDate(date: string | undefined): string | null {
  if (!date) return null;
  const y = new Date(date).getFullYear();
  return isNaN(y) ? null : String(y);
}

function isUnreleased(game: Game): boolean {
  if (!game.releaseDate) return false;
  return new Date(game.releaseDate) > new Date();
}

function hasRealScore(game: Game): boolean {
  if (isUnreleased(game)) return false;
  if (game.score === 0 && game.scoreSource === "gx") return false;
  return true;
}

function scoreGlowBorder(score: number): string {
  if (score >= 80) return "hover:shadow-[0_0_30px_-8px_rgba(74,222,128,0.25)]";
  if (score >= 65) return "hover:shadow-[0_0_30px_-8px_rgba(163,230,53,0.25)]";
  if (score >= 45) return "hover:shadow-[0_0_30px_-8px_rgba(250,204,21,0.25)]";
  return "hover:shadow-[0_0_30px_-8px_rgba(248,113,113,0.25)]";
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
          className={cn(
            "relative rounded-2xl border border-border bg-surface overflow-hidden card-shimmer h-full hover:border-accent/30 transition-all duration-500",
            hasRealScore(game) ? scoreGlowBorder(game.score) : "hover:shadow-[0_0_40px_-8px_rgba(168,85,247,0.2)]"
          )}
        >
          <div className="relative aspect-[3/4] overflow-hidden">
            {game.coverImage ? (
              <BlurImage
                src={game.coverImage}
                alt={game.title}
                sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover group-hover:scale-110"
                priority={priority}
              />
            ) : (
              <div className="absolute inset-0 bg-surface-2 flex items-center justify-center">
                <span className="text-tertiary text-xs font-medium">{game.title.slice(0, 2).toUpperCase()}</span>
              </div>
            )}
            <div className="absolute inset-0 card-image-gradient" />
            {hasRealScore(game) ? (
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
            ) : isUnreleased(game) ? (
              <div className="absolute top-3 right-3 rounded-xl px-2.5 py-1 bg-accent/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white">
                Coming Soon
              </div>
              ) : null}

              {game.trendingReason && (
                <div className="absolute bottom-3 right-3 z-[1]">
                  <span className="text-[9px] font-bold text-white bg-white/15 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10 whitespace-nowrap">
                    {game.trendingReason}
                  </span>
                </div>
              )}
            </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2 z-[1]">
            <div className="flex items-center gap-1.5 flex-wrap">
              {game.platforms.slice(0, 5).map((p) => (
                <PlatformIcon key={p} platform={p} size={14} className="drop-shadow-md brightness-0 invert opacity-80" />
              ))}
              {game.platforms.length > 5 && (
                <span className="text-[9px] text-white/40">+{game.platforms.length - 5}</span>
              )}
              {yearFromDate(game.releaseDate) && (
                <span className="text-[10px] text-white/50 font-medium ml-auto">
                  {yearFromDate(game.releaseDate)}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white leading-tight line-clamp-2 group-hover:text-accent transition-colors drop-shadow-md">
              {game.title}
            </h3>
            {hasRealScore(game) && <VerdictBadge label={game.verdictLabel} size="sm" />}
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
        className={cn(
          "relative rounded-2xl border border-border bg-surface overflow-hidden card-shimmer h-full hover:border-accent/30 transition-all duration-500",
          hasRealScore(game) ? scoreGlowBorder(game.score) : "hover:shadow-[0_0_30px_-8px_rgba(168,85,247,0.15)]"
        )}
      >
        <div className="relative aspect-[3/4] overflow-hidden">
          {game.coverImage ? (
            <BlurImage
              src={game.coverImage}
              alt={game.title}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover group-hover:scale-110"
              priority={priority}
            />
          ) : (
            <div className="absolute inset-0 bg-surface-2 flex items-center justify-center">
              <span className="text-tertiary text-xs font-medium">{game.title.slice(0, 2).toUpperCase()}</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />

          {hasRealScore(game) && (
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
          )}
          {isUnreleased(game) && (
            <div className="absolute top-2.5 right-2.5 rounded-xl px-2 py-1 bg-accent/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white">
              Coming Soon
            </div>
          )}

          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
            {game.platforms.slice(0, 4).map((p) => (
              <PlatformIcon key={p} platform={p} size={14} className="drop-shadow-md brightness-0 invert opacity-80" />
            ))}
            {game.platforms.length > 4 && (
              <span className="text-[9px] text-white/50 font-medium">+{game.platforms.length - 4}</span>
            )}
          </div>

          {yearFromDate(game.releaseDate) && (
            <div className="absolute top-2.5 left-2.5">
              <span className="text-[10px] text-white/70 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-lg font-medium border border-white/5">
                {yearFromDate(game.releaseDate)}
              </span>
            </div>
          )}

          {game.trendingReason && (
            <div className="absolute bottom-2.5 right-2.5 z-[1]">
              <span className="text-[9px] font-bold text-white bg-white/15 backdrop-blur-md px-1.5 py-0.5 rounded-lg border border-white/10 whitespace-nowrap">
                {game.trendingReason}
              </span>
            </div>
          )}
        </div>

        <div className="p-3 space-y-1.5">
          <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-accent transition-colors">
            {game.title}
          </h3>

          {hasRealScore(game) && <VerdictBadge label={game.verdictLabel} size="sm" />}

          <div className="flex flex-wrap gap-1.5">
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
