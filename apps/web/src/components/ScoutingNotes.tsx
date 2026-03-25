"use client";

import { useState, useRef, useEffect } from "react";

interface ScoutingNotesProps {
  text: string;
  clamp?: number;
  className?: string;
  flagged?: boolean;
  onToggleFlag?: () => void;
  showFlagButton?: boolean;
}

export function ScoutingNotes({ text, clamp = 2, className = "", flagged = false, onToggleFlag, showFlagButton = false }: ScoutingNotesProps) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) setIsClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  const accentColor = flagged ? "var(--color-accent-tactical)" : "var(--color-accent-personality)";

  return (
    <div className={`mt-1 ${className}`}>
      <div className="flex items-start gap-1">
        <p
          ref={ref}
          onClick={() => isClamped && setExpanded(!expanded)}
          className={`flex-1 text-[10px] sm:text-xs text-[var(--text-secondary)] leading-snug border-l-2 pl-2 ${
            !expanded ? `line-clamp-${clamp}` : ""
          } ${isClamped ? "cursor-pointer" : ""}`}
          style={{
            borderColor: accentColor,
            ...(!expanded ? { WebkitLineClamp: clamp, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined),
          }}
        >
          {text}
        </p>
        {showFlagButton && onToggleFlag && (
          <button
            onClick={onToggleFlag}
            title={flagged ? "Flagged for rewrite" : "Flag for rewrite"}
            className="shrink-0 mt-0.5 p-0.5 hover:opacity-80 transition-opacity"
          >
            <svg
              viewBox="0 0 20 20"
              width="12"
              height="12"
              stroke={flagged ? "var(--color-accent-tactical)" : "var(--text-muted)"}
              fill={flagged ? "var(--color-accent-tactical)" : "none"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 3v15M3 3h11l-2 4 2 4H3" />
            </svg>
          </button>
        )}
      </div>
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
