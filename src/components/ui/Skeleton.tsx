import { cn } from "@/lib/utils";

/** Generic skeleton block with shimmer animation. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-sm bg-surface-2 animate-shimmer",
        "bg-gradient-to-r from-surface-2 via-elevated to-surface-2",
        className
      )}
      {...props}
    />
  );
}

/** Card-shaped skeleton for game grids. */
export function GameCardSkeleton() {
  return (
    <div className="rounded-sm border border-border bg-surface overflow-hidden">
      <Skeleton className="aspect-[5/7] w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-1.5 pt-1">
          <Skeleton className="h-5 w-12 rounded-sm" />
          <Skeleton className="h-5 w-16 rounded-sm" />
        </div>
      </div>
    </div>
  );
}

/** Review card skeleton. */
export function ReviewCardSkeleton() {
  return (
    <div className="rounded-sm border border-border bg-surface p-4 space-y-3">
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
    <div className="relative rounded-sm border border-border bg-surface overflow-hidden">
      <Skeleton className="aspect-[16/9] md:aspect-[21/9] w-full" />
      <div className="absolute bottom-0 left-0 right-0 p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-sm" />
          <Skeleton className="h-10 w-24 rounded-sm" />
        </div>
      </div>
    </div>
  );
}

/** Section header skeleton. */
export function SectionHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between mb-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-16" />
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
