import { HeroSkeleton, HorizontalScrollSkeleton, SectionHeaderSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function HomeLoading() {
  return (
    <div className="space-y-0">
      {/* Hero carousel */}
      <section className="relative">
        <div className="max-w-[1400px] mx-auto px-4 pt-4 sm:pt-6 pb-8">
          <HeroSkeleton />
        </div>
      </section>

      {/* Trending */}
      <section className="relative py-12 sm:py-16">
        <div className="max-w-[1400px] mx-auto px-4">
          <SectionHeaderSkeleton />
          <HorizontalScrollSkeleton count={6} />
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-4">
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* For You */}
      <section className="py-12 sm:py-16">
        <div className="max-w-[1400px] mx-auto px-4">
          <SectionHeaderSkeleton />
          <HorizontalScrollSkeleton count={6} />
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-4">
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Discover tabs */}
      <section className="py-12 sm:py-16">
        <div className="max-w-[1400px] mx-auto px-4">
          <SectionHeaderSkeleton />
          <div className="flex gap-2.5 mb-8">
            <Skeleton className="h-10 w-32 rounded-xl" />
            <Skeleton className="h-10 w-24 rounded-xl" />
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
          <HorizontalScrollSkeleton count={6} />
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-4">
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Top Rated */}
      <section className="py-12 sm:py-16">
        <div className="max-w-[1400px] mx-auto px-4">
          <SectionHeaderSkeleton />
          <HorizontalScrollSkeleton count={6} />
        </div>
      </section>
    </div>
  );
}
