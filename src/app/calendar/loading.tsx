export default function CalendarLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="h-8 w-52 bg-surface rounded-xl animate-pulse" />
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 w-28 shrink-0 rounded-xl bg-surface animate-pulse" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="h-5 w-40 bg-surface rounded animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="aspect-[3/4] rounded-2xl bg-surface animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
