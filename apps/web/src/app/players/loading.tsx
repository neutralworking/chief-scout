export default function PlayersLoading() {
  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="h-6 w-32 bg-[var(--bg-elevated)] rounded animate-pulse" />
        <div className="h-8 w-48 bg-[var(--bg-elevated)] rounded animate-pulse" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-[var(--bg-elevated)] rounded animate-pulse" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="glass rounded-lg p-4 flex items-center gap-4">
            <div className="h-4 w-32 bg-[var(--bg-elevated)] rounded animate-pulse" />
            <div className="h-3 w-20 bg-[var(--bg-elevated)] rounded animate-pulse" />
            <div className="h-3 w-16 bg-[var(--bg-elevated)] rounded animate-pulse" />
            <div className="flex-1" />
            <div className="h-3 w-12 bg-[var(--bg-elevated)] rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
