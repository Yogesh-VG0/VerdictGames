"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, type Variants, type PanInfo } from "framer-motion";
import { Game } from "@/lib/types";
import VerdictBadge from "@/components/ui/VerdictBadge";
import ScoreRing from "@/components/ui/ScoreRing";
import PixelButton from "@/components/ui/PixelButton";
import PlatformIcon from "@/components/ui/PlatformIcon";
import { collapsePlatforms } from "@/lib/utils/platform";
import { cn } from "@/lib/utils";

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

  // Context-aware reason label per slide
  const getReasonLabel = (g: Game): string => {
    if (g.isFeaturedManual) return "Editor's Pick";
    if (g.isProvisional || (g.releaseDate && new Date(g.releaseDate) > new Date())) return "Coming Soon";
    if (g.isTrendingManual || g.trending) return "Trending Now";
    if (g.score >= 90) return "Top Rated";
    if (g.priceCurrent === 0 || g.isFree) return "Free to Play";
    if (g.priceLowest && g.priceCurrent && g.priceCurrent < g.priceLowest) return "On Sale";
    if (g.featured) return "Featured";
    return "Spotlight";
  };

  return (
    <section
      className="relative overflow-hidden group touch-pan-y"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >

      {/* Background images with swipe support */}
      <motion.div
        className="relative aspect-[3/4] sm:aspect-[16/9] md:aspect-[2.2/1] overflow-hidden cursor-grab active:cursor-grabbing"
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
            {(game.headerImage || game.coverImage) ? (
              <Image
                src={game.headerImage || game.coverImage}
                alt={game.title}
                fill
                sizes="100vw"
                className="object-cover"
                priority={currentIndex === 0}
                quality={90}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-accent/20 via-surface to-pixel-cyan/10" />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Minimal gradient for text readability — no heavy blur */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-[1]" />
      </motion.div>

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-[2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6 sm:pb-8 md:pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={`content-${currentIndex}`}
            variants={contentVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="space-y-2.5 sm:space-y-3"
          >
            {/* Reason label */}
            <span className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] text-accent">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pixel-pulse" />
              {getReasonLabel(game)}
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
              <div className="hidden sm:flex items-center gap-2.5 flex-wrap">
                {(() => {
                  const { visible, overflow } = collapsePlatforms(game.platforms, 4);
                  return (
                    <>
                      {visible.map((p) => (
                        <PlatformIcon key={p} platform={p} size={18} className="drop-shadow-md brightness-0 invert opacity-90" />
                      ))}
                      {overflow > 0 && (
                        <span className="text-xs hero-overlay-text-muted">+{overflow}</span>
                      )}
                    </>
                  );
                })()}
                {game.releaseDate && (
                  <span className="text-xs hero-overlay-text-muted font-medium">
                    {new Date(game.releaseDate).getFullYear()}
                  </span>
                )}
              </div>
            </div>

            {/* Summary - hidden on very small screens */}
            <p className="hidden sm:block text-sm md:text-base hero-overlay-text-secondary max-w-2xl line-clamp-2">
              {game.verdictSummary}
            </p>

            {/* Metadata row */}
            <div className="hidden sm:flex items-center gap-2 text-xs hero-overlay-text-muted flex-wrap">
              {game.genres.slice(0, 2).map((g, i) => (
                <span key={g}>
                  {i > 0 && <span className="mr-2">·</span>}
                  {g}
                </span>
              ))}
              {game.hltbMain && (
                <>
                  <span>·</span>
                  <span>{Math.round(game.hltbMain)}h main story</span>
                </>
              )}
              {game.currentPlayers && game.currentPlayers > 1000 && (
                <>
                  <span>·</span>
                  <span>{(game.currentPlayers / 1000).toFixed(1)}K playing</span>
                </>
              )}
            </div>

            {/* CTAs */}
            <div className="flex gap-3 pt-0.5 sm:pt-1 flex-wrap">
              <Link href={`/game/${game.slug}`} onClick={(e) => { if (isSwiping.current) e.preventDefault(); }}>
                <PixelButton size="md">Read Verdict</PixelButton>
              </Link>
              {game.trailerUrl && (
                <a
                  href={game.trailerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => { if (isSwiping.current) e.preventDefault(); }}
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Trailer
                </a>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
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
