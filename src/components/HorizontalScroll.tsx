"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface HorizontalScrollProps {
  children: React.ReactNode;
  className?: string;
}

export default function HorizontalScroll({
  children,
  className,
}: HorizontalScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollBy(dir: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.6;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  return (
    <div className={cn("relative group", className)}>
      {/* Gradient edge fades */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-[1] opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background via-background/80 to-transparent z-[1]" />

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-2"
      >
        {children}
      </div>

      {/* Nav arrows (desktop only) */}
      <button
        onClick={() => scrollBy("left")}
        className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-sm bg-background/80 backdrop-blur-sm border border-border items-center justify-center text-secondary hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Scroll left"
      >
        ‹
      </button>
      <button
        onClick={() => scrollBy("right")}
        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-sm bg-background/80 backdrop-blur-sm border border-border items-center justify-center text-secondary hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Scroll right"
      >
        ›
      </button>
    </div>
  );
}
