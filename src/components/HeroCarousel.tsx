"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Game } from "@/lib/types";
import VerdictBadge from "@/components/ui/VerdictBadge";
import ScoreRing from "@/components/ui/ScoreRing";
import PixelButton from "@/components/ui/PixelButton";
import PlatformIcon from "@/components/ui/PlatformIcon";
import HeroImage from "@/components/ui/HeroImage";
import { collapsePlatforms } from "@/lib/utils/platform";
import { cn, sourceLabel, getStableYear, isFutureDate } from "@/lib/utils";

interface HeroCarouselProps {
  games: Game[];
  /** Auto-advance interval in ms (default: 6000) */
  interval?: number;
}

const slideVariants: Variants = {
  enter: {
    opacity: 0,
    scale: 1.04,
  },
  center: {
    opacity: 1,
    scale: 1,
    transition: {
      opacity: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
      scale: { duration: 1.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
    },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: {
      opacity: { duration: 0.35, ease: "easeIn" as const },
      scale: { duration: 0.35, ease: "easeIn" as const },
    },
  },
};

const SWIPE_THRESHOLD = 40;
const SWIPE_VELOCITY = 300;

export default function HeroCarousel({ games, interval = 6000 }: HeroCarouselProps) {
  const [[page, direction], setPage] = useState([0, 0]);
  const [isPaused, setIsPaused] = useState(false);
  const isSwiping = useRef(false);
  const isAnimating = useRef(false);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const containerRef = useRef<HTMLElement>(null);

  const slideCount = games.length;
  const currentIndex = ((page % slideCount) + slideCount) % slideCount;
  const game = games[currentIndex];
  const prioritizeHeroImage = page === 0 && direction === 0 && currentIndex === 0;

  const paginate = useCallback(
    (newDirection: number) => {
      if (isAnimating.current) return;
      isAnimating.current = true;
      setPage(([p]) => [p + newDirection, newDirection]);
      setTimeout(() => { isAnimating.current = false; }, 600);
    },
    []
  );

  const goToSlide = useCallback(
    (targetIndex: number) => {
      if (isAnimating.current) return;
      isAnimating.current = true;
      setPage(([, ]) => [targetIndex, targetIndex > currentIndex ? 1 : -1]);
      setTimeout(() => { isAnimating.current = false; }, 600);
    },
    [currentIndex]
  );

  // Touch handlers for mobile swipe — applied to entire hero section
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    isSwiping.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = Math.abs(e.touches[0].clientX - touchStart.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStart.current.y);
    // Mark as swiping if horizontal movement dominates
    if (dx > 10 && dx > dy) {
      isSwiping.current = true;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = Math.abs(touch.clientY - touchStart.current.y);
    const dt = Date.now() - touchStart.current.time;
    const velocity = Math.abs(dx) / (dt || 1) * 1000;

    // Only count horizontal swipes (not vertical scroll)
    if (Math.abs(dx) > dy && (Math.abs(dx) > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY)) {
      if (dx < 0) paginate(1);
      else paginate(-1);
    }
    touchStart.current = null;
    // Delay clearing swipe flag so click handlers can check it
    setTimeout(() => { isSwiping.current = false; }, 150);
  }, [paginate]);

  // Click-to-pause/play (for non-interactive areas)
  const handleHeroClick = useCallback((e: React.MouseEvent) => {
    // Don't toggle pause if user was swiping
    if (isSwiping.current) return;
    // Don't toggle if clicking a button, link, or interactive element
    const target = e.target as HTMLElement;
    if (target.closest("a, button, [role='button'], input, [data-interactive]")) return;
    setIsPaused((p) => !p);
  }, []);

  // Keyboard navigation (left/right arrows)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      paginate(-1);
    } else if (e.key === "ArrowRight") {
      paginate(1);
    } else if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      setIsPaused((p) => !p);
    }
  }, [paginate]);

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
    if (g.isProvisional || isFutureDate(g.releaseDate)) return "Coming Soon";
    if (g.isTrendingManual || g.trending) return "Trending Now";
    if (g.score >= 90) return "Top Rated";
    if (g.priceCurrent === 0 || g.isFree) return "Free to Play";
    if (g.priceLowest && g.priceCurrent && g.priceCurrent < g.priceLowest) return "On Sale";
    if (g.featured) return "Featured";
    return "Spotlight";
  };

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden group outline-none"
      style={{ perspective: "1200px" }}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured games"
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleHeroClick}
    >

      {/* Background images */}
      <div
        className="relative h-[70vh] sm:h-[72vh] md:h-[75vh] min-h-[380px] max-h-[700px] sm:max-h-[800px] overflow-hidden"
      >
        <AnimatePresence initial={false} custom={direction} mode="sync">
          <motion.div
            key={page}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0"
            style={{ transformStyle: "preserve-3d" }}
          >
            {(game.headerImage || game.coverImage) ? (
              <HeroImage
                src={game.headerImage || game.coverImage}
                alt={game.title}
                className="object-center"
                priority={prioritizeHeroImage}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-accent/20 via-surface to-pixel-cyan/10" />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Cinematic gradient overlay — stronger left-to-right + bottom-to-top for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10 z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent z-[1]" />
      </div>

      {/* Content overlay — receives touch events for swipe */}
      <div className="absolute bottom-0 left-0 right-0 z-[2]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pb-6 sm:pb-8 md:pb-12">
          <div
            key={`content-${currentIndex}`}
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
              <div className="flex flex-col items-center gap-0.5">
                <ScoreRing score={game.score} size={40} strokeWidth={3} className="sm:hidden" />
                <ScoreRing score={game.score} size={56} strokeWidth={3} className="hidden sm:block" />
                {sourceLabel(game.scoreSource) && (
                  <span className="text-[9px] font-medium hero-overlay-text-muted uppercase tracking-wider opacity-70">
                    {sourceLabel(game.scoreSource)}
                  </span>
                )}
              </div>
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
                    {getStableYear(game.releaseDate)}
                  </span>
                )}
              </div>
            </div>

            {/* Summary - prefer actual description over template verdict summary */}
            <p className="hidden sm:block text-sm md:text-base hero-overlay-text-secondary max-w-2xl line-clamp-2">
              {(game.description && game.description.length > 20 && !game.description.includes("is an exceptional") && !game.description.includes("is a solid") && !game.description.includes("has moments of brilliance") && !game.description.includes("struggles to deliver"))
                ? game.description.slice(0, 200) + (game.description.length > 200 ? "…" : "")
                : game.verdictSummary}
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
            <div className="flex gap-3 pt-0.5 sm:pt-1 flex-wrap" data-interactive>
              <Link href={`/game/${game.slug}`} prefetch={false} onClick={(e) => { if (isSwiping.current) e.preventDefault(); }}>
                <PixelButton as="span" size="md">Read Verdict</PixelButton>
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
          </div>
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
        <div className="absolute bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 md:right-10 z-[3] flex items-center gap-1.5 sm:gap-2 bg-black/30 backdrop-blur-sm rounded-full px-2 py-1.5" data-interactive>
          {games.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
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

      {/* Accent line on pause + pause/play indicator */}
      {slideCount > 1 && isPaused ? (
        <>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-50 z-[3]" />
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-[4] flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/15 text-white/60 text-[10px] font-medium pointer-events-none">
            <svg width="8" height="8" viewBox="0 0 12 12" fill="currentColor"><rect x="1" y="1" width="3.5" height="10" rx="0.5" /><rect x="7.5" y="1" width="3.5" height="10" rx="0.5" /></svg>
            Paused — click to resume
          </div>
        </>
      ) : slideCount > 1 ? (
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-[4] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/15 text-white/40 text-[10px] font-medium">
            <svg width="8" height="8" viewBox="0 0 12 12" fill="currentColor"><rect x="1" y="1" width="3.5" height="10" rx="0.5" /><rect x="7.5" y="1" width="3.5" height="10" rx="0.5" /></svg>
            Click to pause
          </div>
        </div>
      ) : null}
    </section>
  );
}
