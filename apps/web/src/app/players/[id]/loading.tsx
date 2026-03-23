export default function PlayerDetailLoading() {
  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header skeleton */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-[var(--bg-elevated)] animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-48 bg-[var(--bg-elevated)] rounded animate-pulse" />
            <div className="h-4 w-32 bg-[var(--bg-elevated)] rounded animate-pulse" />
            <div className="flex gap-2 mt-2">
              <div className="h-5 w-16 bg-[var(--bg-elevated)] rounded-full animate-pulse" />
              <div className="h-5 w-20 bg-[var(--bg-elevated)] rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Content grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6 h-64 animate-pulse" />
        <div className="card p-6 h-64 animate-pulse" />
      </div>
      <div className="card p-6 h-48 animate-pulse" />
    </div>
  );
}
