"use client";

import { useRouter } from "next/navigation";

export function BackLink({ fallback = "/players", label = "Players" }: { fallback?: string; label?: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallback);
        }
      }}
      className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
    >
      &larr; {label}
    </button>
  );
}
