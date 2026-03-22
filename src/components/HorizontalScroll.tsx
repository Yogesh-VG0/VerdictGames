"use client";

import { useRef, useState, useCallback, useEffect, type MouseEvent, type PointerEvent } from "react";
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const dragState = useRef({
    startX: 0,
    scrollLeft: 0,
    isDown: false,
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

  const onPointerDown = useCallback((e: PointerEvent) => {
    if (!scrollRef.current || !wrapperRef.current) return;
    // Allow button clicks to pass through
    if ((e.target as HTMLElement).closest("button[aria-label]")) return;

    dragState.current = {
      startX: e.clientX,
      scrollLeft: scrollRef.current.scrollLeft,
      isDown: true,
      lastX: e.clientX,
      lastTime: Date.now(),
      velocity: 0,
    };
    setIsDragging(true);
    setHasMoved(false);
    wrapperRef.current.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragState.current.isDown || !scrollRef.current) return;
    e.preventDefault();

    const dx = e.clientX - dragState.current.startX;
    const walk = dx * 1.2;
    if (Math.abs(walk) > 5) setHasMoved(true);
    scrollRef.current.scrollLeft = dragState.current.scrollLeft - walk;

    // Track velocity for momentum
    const now = Date.now();
    const dt = now - dragState.current.lastTime;
    if (dt > 0) {
      dragState.current.velocity = (e.clientX - dragState.current.lastX) / dt;
    }
    dragState.current.lastX = e.clientX;
    dragState.current.lastTime = now;
  }, []);

  const onPointerUp = useCallback((e: PointerEvent) => {
    if (!dragState.current.isDown) return;
    dragState.current.isDown = false;
    if (wrapperRef.current) {
      wrapperRef.current.releasePointerCapture(e.pointerId);
    }

    // Apply momentum
    const el = scrollRef.current;
    if (el && Math.abs(dragState.current.velocity) > 0.2) {
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

    setTimeout(() => {
      setIsDragging(false);
    }, 50);
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(animFrame.current);
  }, []);

  const onClickCapture = useCallback((e: MouseEvent) => {
    if (hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      setHasMoved(false);
    }
  }, [hasMoved]);

  return (
    <div
      ref={wrapperRef}
      className={cn("relative group", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onClickCapture={onClickCapture}
      onDragStart={(e) => e.preventDefault()}
      style={{ touchAction: "pan-y" }}
    >
      <div
        ref={scrollRef}
        className={cn(
          "flex gap-4 overflow-x-auto no-scrollbar scroll-smooth select-none",
          snap && "snap-x snap-mandatory",
          isDragging && hasMoved && "cursor-grabbing scroll-auto [&_a]:pointer-events-none [&_button]:pointer-events-none [&_img]:pointer-events-none",
          !isDragging && "cursor-grab"
        )}
      >
        {children}
      </div>

      {/* Drag zone below games — extra padding area for comfortable dragging */}
      <div
        className={cn(
          "h-6 sm:h-8",
          isDragging && hasMoved ? "cursor-grabbing" : "cursor-grab"
        )}
      />

      <button
        onClick={() => scrollByDir("left")}
        className="hidden md:flex absolute -left-3 top-[calc(50%-16px)] -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border items-center justify-center text-secondary hover:text-foreground hover:bg-background opacity-0 group-hover:opacity-100 transition-all"
        aria-label="Scroll left"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="rotate-180"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button
        onClick={() => scrollByDir("right")}
        className="hidden md:flex absolute -right-3 top-[calc(50%-16px)] -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border items-center justify-center text-secondary hover:text-foreground hover:bg-background opacity-0 group-hover:opacity-100 transition-all"
        aria-label="Scroll right"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}
