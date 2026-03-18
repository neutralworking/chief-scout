"use client";

import { useState, useRef, useEffect } from "react";

interface ScoutingNotesProps {
  text: string;
  clamp?: number;
  className?: string;
}

export function ScoutingNotes({ text, clamp = 2, className = "" }: ScoutingNotesProps) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) setIsClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div className={`mt-1 ${className}`}>
      <p
        ref={ref}
        onClick={() => isClamped && setExpanded(!expanded)}
        className={`text-[10px] sm:text-xs text-[var(--text-secondary)] leading-snug border-l-2 border-[var(--color-accent-personality)] pl-2 ${
          !expanded ? `line-clamp-${clamp}` : ""
        } ${isClamped ? "cursor-pointer" : ""}`}
        style={!expanded ? { WebkitLineClamp: clamp, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined}
      >
        {text}
      </p>
      {isClamped && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] mt-0.5 pl-2"
        >
          Show more
        </button>
      )}
    </div>
  );
}
