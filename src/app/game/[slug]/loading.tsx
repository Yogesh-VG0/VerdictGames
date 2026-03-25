import { Skeleton } from "@/components/ui/Skeleton";

export default function GameLoading() {
  return (
    <div className="space-y-0">
      {/* Hero — matches h-[50vh] md:h-[60vh] min-h-[320px] max-h-[600px] */}
      <section className="relative">
        <Skeleton className="w-full h-[50vh] md:h-[60vh] min-h-[320px] max-h-[600px] rounded-none" />
        {/* Overlay content at bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <div className="max-w-6xl mx-auto px-4 pb-8 md:pb-12 space-y-3">
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20 rounded-lg" />
              <Skeleton className="h-7 w-20 rounded-lg" />
              <Skeleton className="h-7 w-16 rounded-lg" />
            </div>
            <Skeleton className="h-10 md:h-14 w-80 max-w-full rounded-xl" />
            <Skeleton className="h-4 w-64 rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Main content — matches max-w-[1400px] lg:grid-cols-12 gap-8 */}
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left column (col-span-8) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Verdict card */}
            <div className="rounded-2xl border border-border bg-surface overflow-hidden">
              <div className="p-5 md:p-6 space-y-4">
                <div className="flex items-start gap-5">
                  <Skeleton className="w-[72px] h-[72px] sm:w-[88px] sm:h-[88px] rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-28 rounded-full" />
                    <Skeleton className="h-4 w-full rounded-lg" />
                    <Skeleton className="h-4 w-3/4 rounded-lg" />
                  </div>
                </div>
                <div className="pt-4 border-t border-border/50">
                  <div className="grid grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="text-center space-y-1">
                        <Skeleton className="h-6 w-12 mx-auto rounded-lg" />
                        <Skeleton className="h-3 w-16 mx-auto rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Pros/Cons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/30">
                {[0, 1].map((col) => (
                  <div key={col} className="p-5 space-y-2.5">
                    <Skeleton className="h-4 w-24 rounded-lg" />
                    <Skeleton className="h-3 w-full rounded" />
                    <Skeleton className="h-3 w-5/6 rounded" />
                    <Skeleton className="h-3 w-4/6 rounded" />
                  </div>
                ))}
              </div>
            </div>

            {/* Overview */}
            <div className="rounded-2xl border border-border bg-surface p-5 md:p-6 space-y-4">
              <Skeleton className="h-4 w-24 rounded-lg" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-3/4 rounded" />
              <div className="flex flex-wrap gap-1.5 pt-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-16 rounded-full" />
                ))}
              </div>
            </div>

            {/* Media */}
            <div className="rounded-2xl border border-border bg-surface p-5 md:p-6 space-y-4">
              <Skeleton className="h-4 w-16 rounded-lg" />
              <Skeleton className="aspect-video w-full rounded-xl" />
            </div>

            {/* Performance */}
            <div className="rounded-2xl border border-border bg-surface p-5 md:p-6 space-y-4">
              <Skeleton className="h-4 w-32 rounded-lg" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-5/6 rounded" />
            </div>
          </div>

          {/* Right column (col-span-4) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Library selector */}
            <Skeleton className="h-12 w-full rounded-xl" />

            {/* HLTB */}
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
              <Skeleton className="h-4 w-36 rounded-lg" />
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            </div>

            {/* Where to Play */}
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
              <Skeleton className="h-4 w-28 rounded-lg" />
              <div className="space-y-2.5">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
              <div className="pt-3 border-t border-border/50 space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
              <Skeleton className="h-4 w-16 rounded-lg" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-3 w-28 rounded" />
                </div>
              ))}
            </div>

            {/* Live Stats */}
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
              <Skeleton className="h-4 w-24 rounded-lg" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-24 rounded" />
                    <Skeleton className="h-3 w-8 rounded" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
