import { HeroSkeleton, GameGridSkeleton, SectionHeaderSkeleton } from "@/components/ui/Skeleton";

export default function HomeLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-10">
      <HeroSkeleton />
      <section>
        <SectionHeaderSkeleton />
        <GameGridSkeleton count={4} />
      </section>
      <section>
        <SectionHeaderSkeleton />
        <GameGridSkeleton count={8} />
      </section>
      <section>
        <SectionHeaderSkeleton />
        <GameGridSkeleton count={8} />
      </section>
    </div>
  );
}
