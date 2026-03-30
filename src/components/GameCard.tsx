"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Gamepad2 } from "lucide-react";
import { Game } from "@/lib/types";
import { scoreColor, cn, sourceLabel, scoreGlowClass, getStableYear, isFutureDate } from "@/lib/utils";
import { collapsePlatforms } from "@/lib/utils/platform";
import VerdictBadge from "@/components/ui/VerdictBadge";
import PlatformIcon from "@/components/ui/PlatformIcon";

interface GameCardProps {
  game: Game;
  priority?: boolean;
  prefetch?: boolean;
  className?: string;
  variant?: "default" | "spotlight";
}

function BlurImage({ src, alt, priority, className }: {
  src: string; alt: string; sizes?: string; priority?: boolean; className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <div className={cn(
        "absolute inset-0 bg-surface-2 transition-opacity duration-500",
        loaded ? "opacity-0" : "opacity-100"
      )} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-all duration-700",
          loaded ? "opacity-100 scale-100" : "opacity-0 scale-105 blur-sm",
          className
        )}
        loading={priority ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}

function yearFromDate(date: string | undefined): string | null {
  return getStableYear(date);
}

function isUnreleased(game: Game): boolean {
  return isFutureDate(game.releaseDate);
}

function hasRealScore(game: Game): boolean {
  if (isUnreleased(game)) return false;
  if (game.score === 0 && game.scoreSource === "gx") return false;
  if (game.verdictLabel === "JUST RELEASED") return false;
  if (game.verdictLabel === "COMING SOON") return false;
  return game.score > 0;
}

function scoreGlowBorder(score: number): string {
  if (score >= 80) return "hover:shadow-[0_0_20px_-8px_rgba(74,222,128,0.15)]";
  if (score >= 65) return "hover:shadow-[0_0_20px_-8px_rgba(163,230,53,0.15)]";
  if (score >= 45) return "hover:shadow-[0_0_20px_-8px_rgba(250,204,21,0.15)]";
  return "hover:shadow-[0_0_20px_-8px_rgba(248,113,113,0.15)]";
}

export default function GameCard({
  game,
  priority = false,
  prefetch = false,
  className,
  variant = "default",
}: GameCardProps) {
  if (variant === "spotlight") {
    return (
      <Link href={`/game/${game.slug}`} prefetch={prefetch} className={cn("block group", className)}>
        <motion.article
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            "relative rounded-2xl border border-border bg-surface overflow-hidden card-shimmer h-full hover:border-accent/30 transition-all duration-500",
            hasRealScore(game) ? scoreGlowBorder(game.score) : "hover:shadow-[0_0_20px_-8px_rgba(168,85,247,0.12)]"
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
                {game.score}
                {sourceLabel(game.scoreSource) && (
                  <span className="text-[8px] opacity-50 font-medium uppercase">{sourceLabel(game.scoreSource)}</span>
                )}
              </div>
            ) : isUnreleased(game) ? (
              <div className="absolute top-3 right-3 rounded-xl px-2.5 py-1 bg-accent/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white">
                Coming Soon
              </div>
            ) : game.verdictLabel === "JUST RELEASED" ? (
              <div className="absolute top-3 right-3 rounded-xl px-2.5 py-1 bg-pixel-cyan/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white">
                Just Released
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
            {(() => {
              const { visible, overflow } = collapsePlatforms(game.platforms, 3);
              return (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {visible.map((p) => (
                    <PlatformIcon key={p} platform={p} size={14} className="drop-shadow-md brightness-0 invert opacity-80" />
                  ))}
                  {overflow > 0 && (
                    <span className="text-[9px] text-white/40">+{overflow}</span>
                  )}
                  {yearFromDate(game.releaseDate) && (
                    <span className="text-[10px] text-white/50 font-medium ml-auto">
                      {yearFromDate(game.releaseDate)}
                    </span>
                  )}
                </div>
              );
            })()}
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
    <Link href={`/game/${game.slug}`} prefetch={prefetch} className={cn("block group", className)}>
      <motion.article
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={cn(
          "relative rounded-2xl border border-border bg-surface overflow-hidden card-shimmer h-full hover:border-accent/30 transition-all duration-500",
          hasRealScore(game) ? scoreGlowBorder(game.score) : "hover:shadow-[0_0_20px_-8px_rgba(168,85,247,0.1)]"
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
            <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-surface-2 to-pixel-cyan/10 flex flex-col items-center justify-center gap-2 p-3">
              <Gamepad2 className="w-8 h-8 text-accent/40" />
              <span className="text-tertiary text-[10px] font-semibold text-center leading-tight line-clamp-3">{game.title}</span>
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
              {game.score}
              {sourceLabel(game.scoreSource) && (
                <span className="text-[7px] opacity-40 font-medium uppercase">{sourceLabel(game.scoreSource)}</span>
              )}
            </div>
          )}
          {isUnreleased(game) && (
            <div className="absolute top-2.5 right-2.5 rounded-xl px-2 py-1 bg-accent/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white">
              Coming Soon
            </div>
          )}
          {!isUnreleased(game) && game.verdictLabel === "JUST RELEASED" && (
            <div className="absolute top-2.5 right-2.5 rounded-xl px-2 py-1 bg-pixel-cyan/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white">
              Just Released
            </div>
          )}

          {(() => {
            const { visible, overflow } = collapsePlatforms(game.platforms, 3);
            return (
              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
                {visible.map((p) => (
                  <PlatformIcon key={p} platform={p} size={14} className="drop-shadow-md brightness-0 invert opacity-80" />
                ))}
                {overflow > 0 && (
                  <span className="text-[9px] text-white/50 font-medium">+{overflow}</span>
                )}
              </div>
            );
          })()}

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

        <div className="p-3.5 space-y-2">
          <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-1 group-hover:text-accent transition-colors h-5">
            {game.title}
          </h3>

          <div className="min-h-[20px]">
            {hasRealScore(game) && <VerdictBadge label={game.verdictLabel} size="sm" />}
          </div>

          <div className="flex items-center gap-1 text-[10px] text-tertiary font-medium min-h-[16px]">
            {game.genres.length > 0 ? game.genres.slice(0, 2).map((g, i) => (
              <span key={g}>
                {i > 0 && <span className="mx-0.5 opacity-40">&middot;</span>}
                {g}
              </span>
            )) : <span className="opacity-0">—</span>}
          </div>
        </div>
      </motion.article>
    </Link>
  );
}
