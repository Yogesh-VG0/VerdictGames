import { Skeleton, ReviewCardSkeleton } from "@/components/ui/Skeleton";

export default function ProfileLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-20 h-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-20 rounded-sm" />
        <Skeleton className="h-20 rounded-sm" />
        <Skeleton className="h-20 rounded-sm" />
      </div>
      <div className="space-y-4 pt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <ReviewCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
