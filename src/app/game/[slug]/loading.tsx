import { Skeleton } from "@/components/ui/Skeleton";

export default function GameLoading() {
  return (
    <div className="space-y-0">
      {/* Hero header image */}
      <Skeleton className="w-full aspect-[21/9] md:aspect-[3/1] min-h-[200px] md:min-h-[360px]" />

      <div className="max-w-6xl mx-auto px-4 -mt-16 relative z-10 space-y-6 pb-12">
        {/* Title + score area */}
        <div className="flex items-end gap-4">
          <Skeleton className="w-20 h-20 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-64 rounded-lg" />
            <Skeleton className="h-4 w-96 max-w-full rounded-lg" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: description + media */}
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
              <Skeleton className="h-5 w-32 rounded-lg" />
              <Skeleton className="h-4 w-full rounded-lg" />
              <Skeleton className="h-4 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4 rounded-lg" />
            </div>
            <Skeleton className="aspect-video w-full rounded-2xl" />
          </div>

          {/* Right: sidebar info */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
              <Skeleton className="h-5 w-24 rounded-lg" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
              <Skeleton className="h-5 w-28 rounded-lg" />
              <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-16 rounded-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
