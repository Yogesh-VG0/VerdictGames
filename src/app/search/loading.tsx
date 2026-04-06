import { GameGridSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function SearchLoading() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-lg" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16 rounded" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-xl" />
          ))}
        </div>
      </div>
      <GameGridSkeleton columns={5} rows={2} />
    </div>
  );
}
