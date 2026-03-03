"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
  const [active, setActive] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (images.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Main image */}
      <div className="relative aspect-video rounded-sm overflow-hidden border border-border bg-surface-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full h-full"
          >
            <Image
              src={images[active]}
              alt={`${alt} screenshot ${active + 1}`}
              fill
              sizes="(max-width: 768px) 100vw, 800px"
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>

        {/* Nav arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActive((p) => (p === 0 ? images.length - 1 : p - 1))}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-sm bg-background/70 backdrop-blur-sm border border-border flex items-center justify-center text-foreground hover:bg-background transition-colors"
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              onClick={() => setActive((p) => (p === images.length - 1 ? 0 : p + 1))}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-sm bg-background/70 backdrop-blur-sm border border-border flex items-center justify-center text-foreground hover:bg-background transition-colors"
              aria-label="Next image"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto no-scrollbar pb-1"
        >
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn(
                "relative shrink-0 w-20 h-12 rounded-sm overflow-hidden border transition-all",
                i === active
                  ? "border-accent ring-1 ring-accent/50"
                  : "border-border opacity-60 hover:opacity-100"
              )}
            >
              <Image
                src={src}
                alt={`Thumbnail ${i + 1}`}
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
