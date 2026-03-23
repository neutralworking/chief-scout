import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="card p-8 max-w-md w-full">
        <div className="text-6xl mb-4 font-mono font-bold text-[var(--text-muted)]">404</div>
        <h1 className="text-lg font-bold tracking-tight mb-2">Page not found</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="text-xs font-semibold px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:bg-[var(--accent-tactical)]/20 hover:text-[var(--accent-tactical)] transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/players"
            className="text-xs font-semibold px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:bg-[var(--accent-personality)]/20 hover:text-[var(--accent-personality)] transition-colors"
          >
            Players
          </Link>
        </div>
      </div>
    </div>
  );
}
