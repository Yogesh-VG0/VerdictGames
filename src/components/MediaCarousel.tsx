"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import HeroImage from "@/components/ui/HeroImage";

interface MediaCarouselProps {
  images: string[];
  alt: string;
  className?: string;
}

export default function MediaCarousel({
  images,
  alt,
  className,
}: MediaCarouselProps) {
  const slides = images.filter(Boolean);
  const [active, setActive] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const carouselId = useId();

  const activeIndex = active < slides.length ? active : 0;

  useEffect(() => {
    thumbnailRefs.current[activeIndex]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeIndex]);

  if (slides.length === 0) return null;

  const showNavigation = slides.length > 1;

  const goTo = (index: number) => {
    setActive(Math.max(0, Math.min(index, slides.length - 1)));
  };

  const goPrevious = () => {
    setActive((current) => {
      const normalized = current < slides.length ? current : 0;
      return normalized === 0 ? slides.length - 1 : normalized - 1;
    });
  };

  const goNext = () => {
    setActive((current) => {
      const normalized = current < slides.length ? current : 0;
      return normalized === slides.length - 1 ? 0 : normalized + 1;
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!showNavigation) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrevious();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    } else if (event.key === "Home") {
      event.preventDefault();
      goTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goTo(slides.length - 1);
    }
  };

  return (
    <div
      className={cn("space-y-3", className)}
      role="region"
      aria-roledescription="carousel"
      aria-label={`${alt} screenshots`}
      onKeyDown={handleKeyDown}
    >
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Screenshot {activeIndex + 1} of {slides.length}
      </div>
      {/* Main image */}
      <div
        id={`${carouselId}-viewport`}
        tabIndex={0}
        className="relative aspect-video rounded-xl overflow-hidden border border-white/[0.08] bg-black/30 outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        aria-label={`Screenshot ${activeIndex + 1} of ${slides.length}`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full h-full"
          >
            <HeroImage
              src={slides[activeIndex]}
              alt={`${alt} screenshot ${activeIndex + 1}`}
              sizes="(min-width: 1024px) 720px, 100vw"
              priority={activeIndex === 0}
              className="w-full h-full object-cover"
              fallbackClassName="bg-black/30"
            />
          </motion.div>
        </AnimatePresence>

        {/* Nav arrows */}
        {showNavigation && (
          <>
            <button
              type="button"
              onClick={goPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              aria-label="Previous image"
              aria-controls={`${carouselId}-viewport`}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              aria-label="Next image"
              aria-controls={`${carouselId}-viewport`}
            >
              <span aria-hidden="true">›</span>
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {showNavigation && (
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto no-scrollbar pb-1"
          role="tablist"
          aria-label={`${alt} screenshot thumbnails`}
        >
          {slides.map((src, i) => (
            <button
              key={i}
              ref={(element) => {
                thumbnailRefs.current[i] = element;
              }}
              type="button"
              onClick={() => goTo(i)}
              className={cn(
                "relative shrink-0 w-20 h-12 rounded-lg overflow-hidden border transition-all",
                i === activeIndex
                  ? "border-accent ring-1 ring-accent/50"
                  : "border-white/10 opacity-60 hover:opacity-100"
              )}
              role="tab"
              id={`${carouselId}-tab-${i}`}
              aria-selected={i === activeIndex}
              aria-controls={`${carouselId}-viewport`}
              aria-label={`View screenshot ${i + 1}`}
              tabIndex={i === activeIndex ? 0 : -1}
            >
              <HeroImage
                src={src}
                alt={`${alt} thumbnail ${i + 1}`}
                className="w-full h-full object-cover"
                sizes="80px"
                fallbackClassName="bg-black/30"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
