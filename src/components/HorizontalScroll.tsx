"use client";

import { useRef, useCallback, useEffect } from "react";
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
  const dragState = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    hasMoved: false,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
  });
  const animFrame = useRef<number>(0);

  function scrollByDir(dir: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.6;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  /* ── Mouse-only drag: touch devices use native overflow scroll ── */
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    if ((e.target as HTMLElement).closest("button[aria-label]")) return;
    cancelAnimationFrame(animFrame.current);
    dragState.current = {
      isDown: true,
      startX: e.clientX,
      scrollLeft: scrollRef.current.scrollLeft,
      hasMoved: false,
      lastX: e.clientX,
      lastTime: Date.now(),
      velocity: 0,
    };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current.isDown || !scrollRef.current) return;
    const dx = e.clientX - dragState.current.startX;
    if (Math.abs(dx) > 3) {
      dragState.current.hasMoved = true;
      e.preventDefault();
    }
    scrollRef.current.scrollLeft = dragState.current.scrollLeft - dx * 1.2;
    const now = Date.now();
    const dt = now - dragState.current.lastTime;
    if (dt > 0) {
      dragState.current.velocity = (e.clientX - dragState.current.lastX) / dt;
    }
    dragState.current.lastX = e.clientX;
    dragState.current.lastTime = now;
  }, []);

  const endDrag = useCallback(() => {
    if (!dragState.current.isDown) return;
    dragState.current.isDown = false;

    // Momentum scrolling
    const el = scrollRef.current;
    if (el && dragState.current.hasMoved && Math.abs(dragState.current.velocity) > 0.2) {
      let v = dragState.current.velocity * 150;
      const decelerate = () => {
        if (Math.abs(v) < 0.5 || !el) return;
        el.scrollLeft -= v * 0.016;
        v *= 0.95;
        animFrame.current = requestAnimationFrame(decelerate);
      };
      cancelAnimationFrame(animFrame.current);
      decelerate();
    }

    // Reset hasMoved after a tick so onClickCapture can still catch the click
    setTimeout(() => {
      dragState.current.hasMoved = false;
    }, 0);
  }, []);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (dragState.current.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(animFrame.current);
  }, []);

  return (
    <div className={cn("relative group", className)}>
      <div
        ref={scrollRef}
        className={cn(
          "flex gap-4 overflow-x-auto no-scrollbar scroll-smooth cursor-grab select-none",
          snap && "snap-x snap-mandatory"
        )}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onClickCapture={onClickCapture}
        onDragStart={(e) => e.preventDefault()}
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
