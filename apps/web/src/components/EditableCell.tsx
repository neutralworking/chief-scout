"use client";

import { useState, useEffect, useRef } from "react";

function ratingColor(level: number | null): string {
  if (level == null) return "text-[var(--text-muted)]";
  if (level >= 85) return "text-amber-400";
  if (level >= 78) return "text-green-400";
  if (level >= 70) return "text-[var(--text-primary)]";
  return "text-[var(--text-secondary)]";
}

// Saves on EVERY change (click, arrow, typed value). Serialized: rapid clicks
// collapse — only the latest value is sent. Survives page refresh via sendBeacon.
export function EditableCell({
  value,
  personId,
  field,
  table,
  rowIndex,
  min = 1,
  max = 99,
  onSaved,
}: {
  value: number | null;
  personId: number;
  field: string;
  table: string;
  rowIndex: number;
  min?: number;
  max?: number;
  onSaved?: (newVal: number) => void;
}) {
  const [flash, setFlash] = useState<"saved" | "error" | null>(null);
  const [displayValue, setDisplayValue] = useState(value);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const pendingRef = useRef(value);
  const savedRef = useRef(value);
  const savingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayValue(value);
    pendingRef.current = value;
    savedRef.current = value;
  }, [value]);

  async function flushSave() {
    if (savingRef.current) return;
    savingRef.current = true;
    while (pendingRef.current !== savedRef.current && pendingRef.current !== null) {
      const val = pendingRef.current;
      try {
        const res = await fetch("/api/admin/player-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person_id: personId, table, updates: { [field]: val } }),
        });
        if (res.ok) {
          savedRef.current = val;
          setFlash("saved");
          setTimeout(() => setFlash(null), 600);
        } else {
          setFlash("error");
          setTimeout(() => setFlash(null), 600);
          break;
        }
      } catch {
        setFlash("error");
        setTimeout(() => setFlash(null), 600);
        break;
      }
    }
    savingRef.current = false;
  }

  function saveValue(newVal: number) {
    const clamped = Math.min(max, Math.max(min, newVal));
    if (clamped === pendingRef.current) return;
    setDisplayValue(clamped);
    pendingRef.current = clamped;
    onSaved?.(clamped);
    flushSave();
  }

  useEffect(() => {
    function handleUnload() {
      const val = pendingRef.current;
      if (val !== null && val !== savedRef.current) {
        navigator.sendBeacon(
          "/api/admin/player-update",
          JSON.stringify({ person_id: personId, table, updates: { [field]: val } }),
        );
      }
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [personId, table, field]);

  function commitTyping() {
    const num = Number(draft);
    if (!isNaN(num) && draft !== "") saveValue(num);
    setTyping(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (typing) {
      if (e.key === "Enter") { e.preventDefault(); commitTyping(); }
      if (e.key === "Escape") { setTyping(false); }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      saveValue((pendingRef.current ?? 50) + 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      saveValue((pendingRef.current ?? 50) - 1);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const direction = e.shiftKey ? -1 : 1;
      const nextRow = rowIndex + direction;
      const target = document.querySelector(`[data-edit-field="${field}"][data-edit-row="${nextRow}"]`) as HTMLElement;
      if (target) target.focus();
    } else if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      setTyping(true);
      setDraft(e.key);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  const colorClass = flash === "saved" ? "text-[var(--color-accent-tactical)]" :
    flash === "error" ? "text-red-400" : ratingColor(displayValue);

  if (typing) {
    return (
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitTyping}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        min={min}
        max={max}
        autoFocus
        className="w-12 px-1 py-0.5 text-xs font-mono rounded bg-[var(--bg-surface-solid)] border border-[var(--color-accent-tactical)] text-[var(--text-primary)] focus:outline-none text-right"
        data-edit-field={field}
        data-edit-row={rowIndex}
      />
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded px-0.5 -mx-0.5 outline-none transition-colors ${focused ? "ring-1 ring-[var(--color-accent-tactical)]/50 bg-[var(--bg-elevated)]" : ""}`}
      tabIndex={0}
      data-edit-field={field}
      data-edit-row={rowIndex}
      onClick={(e) => e.stopPropagation()}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={handleKeyDown}
    >
      <button
        onClick={() => saveValue((pendingRef.current ?? 50) - 1)}
        disabled={(displayValue ?? 50) <= min}
        className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20 px-0.5"
        tabIndex={-1}
      >
        &minus;
      </button>
      <span
        className={`font-mono text-xs font-bold min-w-[1.5rem] text-center cursor-text ${colorClass}`}
        onClick={() => { setTyping(true); setDraft(String(pendingRef.current ?? "")); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        {displayValue ?? "–"}
      </span>
      <button
        onClick={() => saveValue((pendingRef.current ?? 50) + 1)}
        disabled={(displayValue ?? 50) >= max}
        className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20 px-0.5"
        tabIndex={-1}
      >
        +
      </button>
    </div>
  );
}
