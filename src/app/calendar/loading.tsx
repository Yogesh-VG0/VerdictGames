export default function CalendarLoading() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-52 bg-surface-2 rounded-lg animate-pulse" />
        <div className="h-3 w-72 bg-surface-2 rounded-lg animate-pulse" />
      </div>
      {/* Month nav */}
      <div className="flex gap-1.5 overflow-hidden pb-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-9 w-28 shrink-0 rounded-xl bg-surface-2 animate-pulse" />
        ))}
      </div>
      {/* Platform filters */}
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-16 shrink-0 rounded-lg bg-surface-2 animate-pulse" />
        ))}
      </div>
      {/* Day groups */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-surface-2" />
            <div className="h-4 w-40 bg-surface-2 rounded animate-pulse" />
            <div className="ml-auto h-3 w-16 bg-surface-2 rounded animate-pulse" />
          </div>
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="flex items-center gap-3 px-4 py-3.5 border-t border-border/50">
              <div className="w-14 h-[74px] sm:w-[72px] sm:h-24 shrink-0 rounded-lg bg-surface-2 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-surface-2 rounded animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-3 w-16 bg-surface-2 rounded animate-pulse" />
                  <div className="h-3 w-12 bg-surface-2 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-8 w-12 bg-surface-2 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
