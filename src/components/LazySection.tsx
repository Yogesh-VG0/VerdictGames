"use client";

import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface LazySectionProps {
  children: React.ReactNode;
  className?: string;
  fallback?: React.ReactNode;
  minHeight?: string;
}

export default function LazySection({
  children,
  className,
  fallback,
  minHeight = "200px",
}: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const defaultFallback = (
    <div
      className="animate-pulse rounded bg-surface"
      style={{ minHeight }}
    />
  );

  return (
    <div ref={ref} className={cn(className)}>
      {isVisible ? children : fallback ?? defaultFallback}
    </div>
  );
}
