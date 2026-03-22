import { ReviewCardSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function ReviewsLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-4 w-80 rounded-lg" />
      </div>
      {/* Source tabs */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-40 rounded-xl" />
        <Skeleton className="h-10 w-48 rounded-xl" />
      </div>
      {/* Filter row */}
      <div className="space-y-2 border-b border-border pb-4">
        <Skeleton className="h-3 w-16 rounded" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <ReviewCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
