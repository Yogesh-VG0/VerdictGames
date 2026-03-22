import { HeroSkeleton, HorizontalScrollSkeleton, SectionHeaderSkeleton } from "@/components/ui/Skeleton";

export default function HomeLoading() {
  return (
    <div className="space-y-0">
      <section className="relative">
        <div className="max-w-[1400px] mx-auto px-4 pt-4 sm:pt-6 pb-8">
          <HeroSkeleton />
        </div>
      </section>
      <section className="py-12 sm:py-16">
        <div className="max-w-[1400px] mx-auto px-4">
          <SectionHeaderSkeleton />
          <HorizontalScrollSkeleton count={6} />
        </div>
      </section>
      <section className="py-12 sm:py-16">
        <div className="max-w-[1400px] mx-auto px-4">
          <SectionHeaderSkeleton />
          <HorizontalScrollSkeleton count={6} />
        </div>
      </section>
      <section className="py-12 sm:py-16">
        <div className="max-w-[1400px] mx-auto px-4">
          <SectionHeaderSkeleton />
          <HorizontalScrollSkeleton count={6} />
        </div>
      </section>
    </div>
  );
}
