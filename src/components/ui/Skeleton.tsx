import { cn } from "@/lib/utils";

/** Generic skeleton block with shimmer animation. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white/5 animate-shimmer",
        "bg-gradient-to-r from-white/5 via-white/10 to-white/5",
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

/** Hero banner skeleton. */
export function HeroSkeleton() {
  return (
    <div className="relative rounded-2xl border border-border bg-surface overflow-hidden">
      <Skeleton className="aspect-[16/9] md:aspect-[21/9] w-full min-h-[300px] md:min-h-[480px] lg:min-h-[560px]" />
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 space-y-3">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="h-4 w-96 max-w-full rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
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
