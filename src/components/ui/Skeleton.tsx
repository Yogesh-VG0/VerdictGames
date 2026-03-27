import { cn } from "@/lib/utils";

/** Generic skeleton block with shimmer animation. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl animate-shimmer",
        "bg-gradient-to-r from-border/40 via-border/70 to-border/40",
        className
      )}
      {...props}
    />
  );
}

/** Card-shaped skeleton for game grids. */
export function GameCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <Skeleton className="aspect-[3/4] w-full" />
      <div className="p-3.5 space-y-2">
        <Skeleton className="h-4 w-3/4 rounded-lg" />
        <Skeleton className="h-3 w-1/2 rounded-lg" />
        <div className="flex gap-1.5 pt-1">
          <Skeleton className="h-4 w-12 rounded-lg" />
          <Skeleton className="h-4 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Horizontal scroll skeleton matching the HorizontalScroll + GameCard layout. */
export function HorizontalScrollSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="shrink-0 w-44 sm:w-52 md:w-56 lg:w-60">
          <div className="rounded-2xl border border-border bg-surface overflow-hidden">
            <Skeleton className="aspect-[3/4] w-full" />
            <div className="p-3.5 space-y-2">
              <Skeleton className="h-4 w-3/4 rounded-lg" />
              <Skeleton className="h-3 w-1/2 rounded-lg" />
              <div className="flex gap-1.5 pt-1">
                <Skeleton className="h-4 w-12 rounded-lg" />
                <Skeleton className="h-4 w-16 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Review card skeleton. */
export function ReviewCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

/** Hero banner skeleton — matches HeroCarousel layout. */
export function HeroSkeleton() {
  return (
    <div className="relative rounded-2xl border border-border bg-surface overflow-hidden">
      <Skeleton className="w-full min-h-[400px] md:min-h-[520px] lg:min-h-[580px] rounded-none" />
      {/* Bottom gradient overlay feel */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
        <div className="px-6 md:px-10 pb-8 md:pb-12 pt-24 space-y-4">
          {/* Platform badges */}
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20 rounded-lg bg-border/60" />
            <Skeleton className="h-7 w-20 rounded-lg bg-border/60" />
            <Skeleton className="h-7 w-24 rounded-lg bg-border/60" />
          </div>
          {/* Title */}
          <Skeleton className="h-10 md:h-14 w-96 max-w-[70%] rounded-xl bg-border/60" />
          {/* Subtitle / verdict */}
          <div className="flex items-center gap-3">
            <Skeleton className="w-14 h-14 rounded-full bg-border/60 shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-24 rounded-full bg-border/60" />
              <Skeleton className="h-3 w-64 max-w-full rounded-lg bg-border/60" />
            </div>
          </div>
          {/* CTA */}
          <Skeleton className="h-10 w-36 rounded-xl bg-border/60" />
        </div>
      </div>
      {/* Dot indicators */}
      <div className="absolute bottom-3 right-6 flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className={cn("w-2 h-2 rounded-full", i === 0 ? "bg-border w-6" : "bg-border/40")} />
        ))}
      </div>
    </div>
  );
}

/** Section header skeleton. */
export function SectionHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56 rounded-lg" />
        <Skeleton className="h-3 w-72 rounded-lg" />
      </div>
      <Skeleton className="h-4 w-20 rounded-lg" />
    </div>
  );
}

/** Full row of game card skeletons. */
export function GameGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <GameCardSkeleton key={i} />
      ))}
    </div>
  );
}
