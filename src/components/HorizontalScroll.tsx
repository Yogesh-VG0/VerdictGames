"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface HorizontalScrollProps {
  children: React.ReactNode;
  className?: string;
  snap?: boolean;
}

export default function HorizontalScroll({
  children,
  className,
  snap = false,
}: HorizontalScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollByDir(dir: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.6;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  return (
    <div className={cn("relative group", className)}>
      <div
        ref={scrollRef}
        className={cn(
          "flex gap-4 overflow-x-auto no-scrollbar scroll-smooth",
          snap && "snap-x snap-mandatory"
        )}
      >
        {children}
      </div>

      <button
        onClick={() => scrollByDir("left")}
        className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border items-center justify-center text-secondary hover:text-foreground hover:bg-background opacity-0 group-hover:opacity-100 transition-all"
        aria-label="Scroll left"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="rotate-180"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button
        onClick={() => scrollByDir("right")}
        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border items-center justify-center text-secondary hover:text-foreground hover:bg-background opacity-0 group-hover:opacity-100 transition-all"
        aria-label="Scroll right"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}
