export default function Loading() {
  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Hero skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 card p-6 h-64">
          <div className="h-3 w-24 bg-[var(--bg-elevated)] rounded mb-4 animate-pulse" />
          <div className="h-6 w-48 bg-[var(--bg-elevated)] rounded mb-2 animate-pulse" />
          <div className="h-4 w-36 bg-[var(--bg-elevated)] rounded animate-pulse" />
        </div>
        <div className="lg:col-span-2 card p-6 h-64">
          <div className="h-3 w-16 bg-[var(--bg-elevated)] rounded mb-4 animate-pulse" />
          <div className="h-5 w-40 bg-[var(--bg-elevated)] rounded mb-2 animate-pulse" />
          <div className="h-4 w-56 bg-[var(--bg-elevated)] rounded animate-pulse" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 card p-5 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-3 w-8 bg-[var(--bg-elevated)] rounded animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 bg-[var(--bg-elevated)] rounded animate-pulse" />
                <div className="h-2.5 w-1/2 bg-[var(--bg-elevated)] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <div className="lg:col-span-2 space-y-3">
          <div className="card p-4 h-32 animate-pulse" />
          <div className="card p-4 h-32 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
