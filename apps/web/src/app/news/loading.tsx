export default function NewsLoading() {
  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="h-6 w-28 bg-[var(--bg-elevated)] rounded animate-pulse" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-20 bg-[var(--bg-elevated)] rounded-full animate-pulse" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="glass rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-16 bg-[var(--bg-elevated)] rounded animate-pulse" />
              <div className="h-3 w-12 bg-[var(--bg-elevated)] rounded animate-pulse" />
            </div>
            <div className="h-4 w-3/4 bg-[var(--bg-elevated)] rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-[var(--bg-elevated)] rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
