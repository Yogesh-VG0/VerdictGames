"use client";

import { useRef, useState, useCallback, type MouseEvent } from "react";
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
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const dragState = useRef({ startX: 0, scrollLeft: 0, isMouseDown: false });

  function scrollBy(dir: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.6;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  const onMouseDown = useCallback((e: MouseEvent) => {
    if (!scrollRef.current) return;
    dragState.current = {
      startX: e.pageX - scrollRef.current.offsetLeft,
      scrollLeft: scrollRef.current.scrollLeft,
      isMouseDown: true,
    };
    setIsDragging(true);
    setHasMoved(false);
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.current.isMouseDown || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - dragState.current.startX) * 1.5;
    if (Math.abs(walk) > 8) setHasMoved(true);
    scrollRef.current.scrollLeft = dragState.current.scrollLeft - walk;
  }, []);

  const stopDragging = useCallback(() => {
    dragState.current.isMouseDown = false;
    setTimeout(() => {
      setIsDragging(false);
    }, 50);
  }, []);

  const onClickCapture = useCallback((e: MouseEvent) => {
    if (hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      setHasMoved(false);
    }
  }, [hasMoved]);

  return (
    <div className={cn("relative group", className)}>
      <div
        ref={scrollRef}
        className={cn(
          "flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-2 select-none",
          snap && "snap-x snap-mandatory",
          isDragging && hasMoved && "cursor-grabbing scroll-auto [&_a]:pointer-events-none [&_button]:pointer-events-none [&_img]:pointer-events-none",
          !isDragging && "cursor-grab"
        )}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        onClickCapture={onClickCapture}
        onDragStart={(e) => e.preventDefault()}
      >
        {children}
      </div>

      <button
        onClick={() => scrollBy("left")}
        className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border items-center justify-center text-secondary hover:text-foreground hover:bg-background opacity-0 group-hover:opacity-100 transition-all"
        aria-label="Scroll left"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="rotate-180"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button
        onClick={() => scrollBy("right")}
        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border items-center justify-center text-secondary hover:text-foreground hover:bg-background opacity-0 group-hover:opacity-100 transition-all"
        aria-label="Scroll right"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}
