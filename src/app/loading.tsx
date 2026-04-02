import { GameGridSkeleton, SectionHeaderSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function HomeLoading() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 sm:py-10 space-y-8">
      {/* Hero carousel */}
      <section className="space-y-3">
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="h-4 w-80 max-w-full rounded-lg" />
      </section>

      {/* Trending */}
      <section className="space-y-4">
        <Skeleton className="h-11 w-full rounded-xl" />
        <div className="flex gap-2 overflow-hidden">
          <Skeleton className="h-8 w-24 rounded-xl" />
          <Skeleton className="h-8 w-20 rounded-xl" />
          <Skeleton className="h-8 w-28 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
      </section>

      <div>
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* For You */}
      <section className="space-y-4">
        <SectionHeaderSkeleton />
        <GameGridSkeleton count={8} />
      </section>

      <div>
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Discover tabs */}
      <section className="space-y-4">
        <SectionHeaderSkeleton />
        <div className="flex gap-2.5 overflow-hidden">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <GameGridSkeleton count={8} />
      </section>

      <div>
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Top Rated */}
      <section className="space-y-4">
        <SectionHeaderSkeleton />
        <GameGridSkeleton count={8} />
      </section>
    </div>
  );
}
