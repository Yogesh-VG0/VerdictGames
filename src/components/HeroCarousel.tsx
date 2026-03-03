"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Game } from "@/lib/types";
import VerdictBadge from "@/components/ui/VerdictBadge";
import ScoreRing from "@/components/ui/ScoreRing";
import PixelBadge from "@/components/ui/PixelBadge";
import PixelButton from "@/components/ui/PixelButton";
import { cn, scoreColor } from "@/lib/utils";

interface HeroCarouselProps {
  games: Game[];
  /** Auto-advance interval in ms (default: 6000) */
  interval?: number;
}

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "60%" : "-60%",
    opacity: 0,
    scale: 0.95,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "60%" : "-60%",
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

const contentVariants: Variants = {
  enter: { opacity: 0, y: 30 },
  center: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: 0.2, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.3, ease: "easeIn" as const },
  },
};

export default function HeroCarousel({ games, interval = 6000 }: HeroCarouselProps) {
  const [[page, direction], setPage] = useState([0, 0]);
  const [isPaused, setIsPaused] = useState(false);

  const slideCount = games.length;
  const currentIndex = ((page % slideCount) + slideCount) % slideCount;
  const game = games[currentIndex];

  const paginate = useCallback(
    (newDirection: number) => {
      setPage(([p]) => [p + newDirection, newDirection]);
    },
    []
  );

  // Auto-advance
  useEffect(() => {
    if (isPaused || slideCount <= 1) return;
    const timer = setInterval(() => paginate(1), interval);
    return () => clearInterval(timer);
  }, [isPaused, slideCount, interval, paginate]);

  if (!game) return null;

  return (
    <section
      className="relative rounded-sm overflow-hidden border border-border group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background images with transition */}
      <div className="relative aspect-[16/9] sm:aspect-[16/9] md:aspect-[21/9] overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={page}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0"
          >
            <Image
              src={game.headerImage}
              alt={game.title}
              fill
              sizes="100vw"
              className="object-cover"
              priority={currentIndex === 0}
            />
          </motion.div>
        </AnimatePresence>

        {/* Static gradient overlays (always visible) */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent z-[1]" />
        <div className="absolute inset-0 hero-spotlight opacity-60 z-[1]" />
      </div>

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 z-[2]">
        <AnimatePresence mode="wait">
          <motion.div
            key={`content-${currentIndex}`}
            variants={contentVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="space-y-3"
          >
            {/* Featured label */}
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pixel-pulse" />
              Featured
            </span>

            {/* Title */}
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight max-w-2xl">
              {game.title}
            </h1>

            {/* Score + Verdict + Platforms */}
            <div className="flex items-center gap-3 flex-wrap">
              <ScoreRing score={game.score} size={56} strokeWidth={3} />
              <VerdictBadge label={game.verdictLabel} size="lg" />
              {game.platforms.map((p) => (
                <PixelBadge key={p} variant={p === "PC" ? "muted" : "success"} size="md">
                  {p}
                </PixelBadge>
              ))}
              {game.releaseDate && (
                <span className="text-xs text-tertiary font-medium">
                  {new Date(game.releaseDate).getFullYear()}
                </span>
              )}
            </div>

            {/* Summary */}
            <p className="text-sm md:text-base text-secondary max-w-2xl line-clamp-2">
              {game.verdictSummary}
            </p>

            {/* CTA */}
            <div className="flex gap-3 pt-1">
              <Link href={`/game/${game.slug}`}>
                <PixelButton size="md">Read Verdict</PixelButton>
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation arrows */}
      {slideCount > 1 && (
        <>
          <button
            onClick={() => paginate(-1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-[3] w-10 h-10 rounded-full
                       bg-background/60 backdrop-blur-sm border border-border/50
                       flex items-center justify-center text-foreground
                       opacity-0 group-hover:opacity-100 transition-opacity duration-300
                       hover:bg-accent/20 hover:border-accent/50"
            aria-label="Previous game"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="rotate-180">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => paginate(1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-[3] w-10 h-10 rounded-full
                       bg-background/60 backdrop-blur-sm border border-border/50
                       flex items-center justify-center text-foreground
                       opacity-0 group-hover:opacity-100 transition-opacity duration-300
                       hover:bg-accent/20 hover:border-accent/50"
            aria-label="Next game"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      )}

      {/* Dot indicators */}
      {slideCount > 1 && (
        <div className="absolute bottom-3 right-4 md:right-8 z-[3] flex items-center gap-2">
          {games.map((_, i) => (
            <button
              key={i}
              onClick={() => setPage([i, i > currentIndex ? 1 : -1])}
              className={cn(
                "transition-all duration-300 rounded-full",
                i === currentIndex
                  ? "w-6 h-2 bg-accent"
                  : "w-2 h-2 bg-foreground/30 hover:bg-foreground/50"
              )}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Progress bar */}
      {slideCount > 1 && !isPaused && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] z-[3]">
          <motion.div
            key={`progress-${page}`}
            className="h-full bg-accent/70"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: interval / 1000, ease: "linear" }}
          />
        </div>
      )}

      {/* Accent line on pause */}
      {slideCount > 1 && isPaused && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-50 z-[3]" />
      )}
    </section>
  );
}
