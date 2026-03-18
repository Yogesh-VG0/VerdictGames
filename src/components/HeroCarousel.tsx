"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, type Variants, type PanInfo } from "framer-motion";
import { Game } from "@/lib/types";
import VerdictBadge from "@/components/ui/VerdictBadge";
import ScoreRing from "@/components/ui/ScoreRing";
import PixelBadge from "@/components/ui/PixelBadge";
import PixelButton from "@/components/ui/PixelButton";
import ScoreChips from "@/components/ScoreChips";
import { cn, scoreColor, platformShort, platformVariant } from "@/lib/utils";

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

const SWIPE_THRESHOLD = 50;

export default function HeroCarousel({ games, interval = 6000 }: HeroCarouselProps) {
  const [[page, direction], setPage] = useState([0, 0]);
  const [isPaused, setIsPaused] = useState(false);
  const isSwiping = useRef(false);

  const slideCount = games.length;
  const currentIndex = ((page % slideCount) + slideCount) % slideCount;
  const game = games[currentIndex];

  const paginate = useCallback(
    (newDirection: number) => {
      setPage(([p]) => [p + newDirection, newDirection]);
    },
    []
  );

  // Touch/swipe handler
  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset, velocity } = info;
      // Swipe if offset or velocity exceeds threshold
      if (Math.abs(offset.x) > SWIPE_THRESHOLD || Math.abs(velocity.x) > 300) {
        if (offset.x < 0) {
          paginate(1);  // swipe left → next
        } else {
          paginate(-1); // swipe right → prev
        }
      }
      // Reset swiping flag after a tick
      setTimeout(() => { isSwiping.current = false; }, 100);
    },
    [paginate]
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
      className="relative rounded-2xl overflow-hidden border border-white/[0.06] group touch-pan-y shadow-[0_8px_60px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.04]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Ambient glow behind the hero */}
      <div className="absolute -inset-1 bg-gradient-to-br from-accent/20 via-transparent to-pixel-cyan/10 blur-2xl opacity-50 -z-10 group-hover:opacity-70 transition-opacity duration-700" />

      {/* Background images with swipe support */}
      <motion.div
        className="relative aspect-[3/4] sm:aspect-[16/9] md:aspect-[2.35/1] overflow-hidden cursor-grab active:cursor-grabbing"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragStart={() => { isSwiping.current = true; }}
        onDragEnd={handleDragEnd}
      >
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

        {/* Static gradient overlays — always dark so images stay vibrant in both themes */}
        <div className="absolute inset-0 hero-gradient-bottom z-[1]" />
        <div className="absolute inset-0 hero-gradient-right z-[1]" />
        <div className="absolute inset-0 hero-gradient-vignette opacity-60 z-[1]" />
      </motion.div>

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-10 z-[2]">
        <AnimatePresence mode="wait">
          <motion.div
            key={`content-${currentIndex}`}
            variants={contentVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="space-y-2.5 sm:space-y-3"
          >
            {/* Featured label */}
            <span className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] text-accent">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pixel-pulse" />
              Featured
              <span className="h-px w-6 bg-accent/40" />
            </span>

            {/* Title */}
            <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-bold hero-overlay-text leading-[1.1] max-w-2xl drop-shadow-lg">
              {game.title}
            </h1>

            {/* Score + Verdict + Platforms */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <ScoreRing score={game.score} size={40} strokeWidth={3} className="sm:hidden" />
              <ScoreRing score={game.score} size={56} strokeWidth={3} className="hidden sm:block" />
              <VerdictBadge label={game.verdictLabel} size="lg" />
              <div className="hidden sm:flex items-center gap-2 flex-wrap">
                {game.platforms.slice(0, 5).map((p) => (
                  <PixelBadge key={p} variant={platformVariant(p)} size="md">
                    {platformShort(p)}
                  </PixelBadge>
                ))}
                {game.platforms.length > 5 && (
                  <span className="text-xs hero-overlay-text-muted">+{game.platforms.length - 5}</span>
                )}
                {game.releaseDate && (
                  <span className="text-xs hero-overlay-text-muted font-medium">
                    {new Date(game.releaseDate).getFullYear()}
                  </span>
                )}
              </div>
            </div>

            {/* Multi-source score chips */}
            <ScoreChips game={game} variant="full" />

            {/* Summary - hidden on very small screens */}
            <p className="hidden sm:block text-sm md:text-base hero-overlay-text-secondary max-w-2xl line-clamp-2">
              {game.verdictSummary}
            </p>

            {/* CTA */}
            <div className="flex gap-3 pt-0.5 sm:pt-1">
              <Link href={`/game/${game.slug}`} onClick={(e) => { if (isSwiping.current) e.preventDefault(); }}>
                <PixelButton size="md">Read Verdict</PixelButton>
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation arrows - hidden on mobile (use swipe instead) */}
      {slideCount > 1 && (
        <>
          <button
            onClick={() => paginate(-1)}
            className="hidden sm:flex absolute left-2 md:left-3 top-1/3 md:top-1/2 -translate-y-1/2 z-[3] w-9 h-9 md:w-10 md:h-10 rounded-full
                       bg-black/50 backdrop-blur-sm border border-white/20
                       items-center justify-center text-white
                       opacity-0 group-hover:opacity-100 transition-opacity duration-300
                       hover:bg-accent/30 hover:border-accent/50"
            aria-label="Previous game"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="rotate-180">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => paginate(1)}
            className="hidden sm:flex absolute right-2 md:right-3 top-1/3 md:top-1/2 -translate-y-1/2 z-[3] w-9 h-9 md:w-10 md:h-10 rounded-full
                       bg-black/50 backdrop-blur-sm border border-white/20
                       items-center justify-center text-white
                       opacity-0 group-hover:opacity-100 transition-opacity duration-300
                       hover:bg-accent/30 hover:border-accent/50"
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
        <div className="absolute bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 md:right-10 z-[3] flex items-center gap-1.5 sm:gap-2 bg-black/30 backdrop-blur-sm rounded-full px-2 py-1.5">
          {games.map((_, i) => (
            <button
              key={i}
              onClick={() => setPage([i, i > currentIndex ? 1 : -1])}
              className={cn(
                "transition-all duration-300 rounded-full",
                i === currentIndex
                  ? "w-6 h-1.5 bg-accent"
                  : "w-1.5 h-1.5 bg-white/40 hover:bg-white/60"
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
