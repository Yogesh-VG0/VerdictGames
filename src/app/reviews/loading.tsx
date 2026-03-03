import { ReviewCardSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function ReviewsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <ReviewCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
