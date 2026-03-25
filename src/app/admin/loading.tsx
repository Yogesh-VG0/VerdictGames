import { Skeleton } from "@/components/ui/Skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-lg mt-2" />
      </div>

      {/* Stats Grid — matches 3 stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-surface p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-3 w-12 rounded" />
            </div>
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        ))}
      </div>

      {/* Two-column: Quick Actions + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="space-y-3">
          <Skeleton className="h-6 w-32 rounded-lg" />
          {/* Add New Game (accent card) */}
          <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4 space-y-2">
            <Skeleton className="h-4 w-36 rounded-lg" />
            <Skeleton className="h-3 w-64 rounded" />
          </div>
          {/* 3 action cards */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-surface p-4 space-y-2"
            >
              <Skeleton className="h-4 w-32 rounded-lg" />
              <Skeleton className="h-3 w-56 rounded" />
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="space-y-3">
          <Skeleton className="h-6 w-36 rounded-lg" />
          <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-2.5 w-24 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Seed Content */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-32 rounded-lg" />
        <Skeleton className="h-3 w-64 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-surface p-4 space-y-2"
            >
              <Skeleton className="h-4 w-40 rounded-lg" />
              <Skeleton className="h-3 w-56 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
