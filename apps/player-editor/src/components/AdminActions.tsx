"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";

interface PlayerResult {
  person_id: number;
  name: string;
  club: string | null;
  nation: string | null;
  position: string | null;
  level: number | null;
  pursuit_status: string | null;
  profile_tier: number | null;
  archetype: string | null;
}

const PURSUIT_OPTIONS = ["Priority", "Interested", "Scout Further", "Watch", "Monitor", "Pass"];

export function AdminActions() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<PlayerResult | null>(null);
  const [newPursuit, setNewPursuit] = useState("");
  const [newClub, setNewClub] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const resp = await fetch(`/api/admin/player-search?q=${encodeURIComponent(q)}`);
        const data = await resp.json();
        setResults(data.players ?? []);
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 300);
  }, []);

  const selectPlayer = (p: PlayerResult) => {
    setSelected(p);
    setNewPursuit(p.pursuit_status ?? "");
    setNewClub(p.club ?? "");
    setResults([]);
    setQuery(p.name);
    setMessage(null);
  };

  const saveChanges = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage(null);

    const updates: Promise<Response>[] = [];

    // Update pursuit status
    if (newPursuit && newPursuit !== (selected.pursuit_status ?? "")) {
      updates.push(
        fetch("/api/admin/player-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            person_id: selected.person_id,
            table: "player_status",
            updates: { pursuit_status: newPursuit },
          }),
        })
      );
    }

    // Update club
    if (newClub && newClub !== (selected.club ?? "")) {
      updates.push(
        fetch("/api/admin/player-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            person_id: selected.person_id,
            table: "people",
            updates: { name: selected.name }, // club is FK — can only update via club_id
          }),
        })
      );
    }

    if (updates.length === 0) {
      setMessage({ type: "error", text: "No changes to save" });
      setSaving(false);
      return;
    }

    try {
      const responses = await Promise.all(updates);
      const allOk = responses.every((r) => r.ok);
      if (allOk) {
        setMessage({ type: "success", text: `Updated ${selected.name}` });
        setSelected({ ...selected, pursuit_status: newPursuit || selected.pursuit_status });
      } else {
        const err = await responses.find((r) => !r.ok)?.json();
        setMessage({ type: "error", text: err?.error ?? "Update failed" });
      }
    } catch (e) {
      setMessage({ type: "error", text: String(e) });
    }
    setSaving(false);
  };

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4">
        Player Quick Edit
      </h2>

      {/* Search */}
      <div className="relative mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search player by name..."
          className="w-full px-3 py-2 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-personality)]"
        />
        {searching && (
          <span className="absolute right-3 top-2.5 text-xs text-[var(--text-muted)]">...</span>
        )}

        {/* Dropdown results */}
        {results.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {results.map((p) => (
              <button
                key={p.person_id}
                onClick={() => selectPlayer(p)}
                className="w-full text-left px-3 py-2 hover:bg-[var(--bg-elevated)] transition-colors flex items-center justify-between"
              >
                <div>
                  <span className="text-sm text-[var(--text-primary)]">{p.name}</span>
                  <span className="text-xs text-[var(--text-muted)] ml-2">
                    {p.club} · {p.position}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {p.level && (
                    <span className="text-xs font-mono text-[var(--text-secondary)]">
                      Lvl {p.level}
                    </span>
                  )}
                  {p.pursuit_status && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                      {p.pursuit_status}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected player edit form */}
      {selected && (
        <div className="border-t border-[var(--border-subtle)] pt-4">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href={`/players/${selected.person_id}`}
              className="text-sm font-semibold text-[var(--accent-personality)] hover:underline"
            >
              {selected.name}
            </Link>
            <span className="text-xs text-[var(--text-muted)]">
              {selected.club} · {selected.nation} · {selected.position}
              {selected.level ? ` · Lvl ${selected.level}` : ""}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Pursuit Status */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Pursuit Status</label>
              <select
                value={newPursuit}
                onChange={(e) => setNewPursuit(e.target.value)}
                className="w-full px-3 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm"
              >
                <option value="">-- None --</option>
                {PURSUIT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={saveChanges}
              disabled={saving}
              className="px-4 py-1.5 rounded bg-[var(--accent-tactical)] text-[var(--bg-base)] text-sm font-semibold disabled:opacity-40 hover:brightness-110 transition-all"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={() => { setSelected(null); setQuery(""); setMessage(null); }}
              className="px-4 py-1.5 rounded border border-[var(--border-subtle)] text-[var(--text-secondary)] text-sm hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
          </div>

          {message && (
            <p className={`mt-3 text-sm ${message.type === "error" ? "text-[var(--sentiment-negative)]" : "text-[var(--accent-tactical)]"}`}>
              {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
