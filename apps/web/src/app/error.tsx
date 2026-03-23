"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="card p-8 max-w-md w-full">
        <div className="text-4xl mb-4 font-mono font-bold text-[var(--text-muted)]">Error</div>
        <h1 className="text-lg font-bold tracking-tight mb-2">Something went wrong</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <button
          onClick={reset}
          className="text-xs font-semibold px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:bg-[var(--accent-tactical)]/20 hover:text-[var(--accent-tactical)] transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
