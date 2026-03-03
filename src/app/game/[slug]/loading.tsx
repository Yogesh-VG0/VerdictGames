import { Skeleton } from "@/components/ui/Skeleton";

export default function GameLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
      <Skeleton className="aspect-[21/9] w-full rounded-sm" />
      <div className="rounded-sm border border-border bg-surface p-6 space-y-4">
        <div className="flex gap-4">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full max-w-lg" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 w-24" />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-sm" />
    </div>
  );
}
