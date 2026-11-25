"use client";

import { preferredScrollBehavior } from '@/lib/utils/motion';
import { useEffect, useRef, useState } from "react";
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
  const contentRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  useEffect(() => {
    const viewport = scrollRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const update = () => {
      const max = viewport.scrollWidth - viewport.clientWidth;
      const left = viewport.scrollLeft > 1;
      const right = viewport.scrollLeft < max - 1;
      setCanScroll(current => current.left === left && current.right === right ? current : { left, right });
    };
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    observer.observe(content);
    viewport.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  function scrollByDir(dir: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.6;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: preferredScrollBehavior(),
    });
  }

  return (
    <div className={cn("relative group", className)}>
      <div
        ref={scrollRef}
        className={cn(
          "overflow-x-auto no-scrollbar motion-safe:scroll-smooth",
          snap && "snap-x snap-mandatory"
        )}
      >
        <div ref={contentRef} className="flex w-max min-w-full gap-4">{children}</div>
      </div>

      {canScroll.left && <button
        onClick={() => scrollByDir("left")}
        className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border items-center justify-center text-secondary hover:text-foreground hover:bg-background opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 motion-safe:transition-opacity"
        aria-label="Scroll left"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="rotate-180"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>}
      {canScroll.right && <button
        onClick={() => scrollByDir("right")}
        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border items-center justify-center text-secondary hover:text-foreground hover:bg-background opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 motion-safe:transition-opacity"
        aria-label="Scroll right"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>}
    </div>
  );
}
