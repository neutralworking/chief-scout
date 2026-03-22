"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface WCNation {
  nation_id: number;
  name: string;
  confederation: string;
  fifa_ranking: number;
  group_letter: string | null;
  seed: number | null;
  kit_emoji: string;
  slug: string;
  player_count: number;
  strength: number | null;
  total_entries: number;
}

const CONFEDERATIONS = [
  { key: "ALL", label: "All" },
  { key: "UEFA", label: "Europe" },
  { key: "CONMEBOL", label: "S. America" },
  { key: "CONCACAF", label: "N. America" },
  { key: "CAF", label: "Africa" },
  { key: "AFC", label: "Asia" },
  { key: "OFC", label: "Oceania" },
];

function strengthColor(s: number | null): string {
  if (s === null) return "var(--text-muted)";
  if (s >= 75) return "var(--color-accent-technical)";
  if (s >= 55) return "var(--color-accent-tactical)";
  if (s >= 35) return "var(--color-accent-mental)";
  return "var(--color-accent-physical)";
}

export default function OnThePlanePage() {
  const [nations, setNations] = useState<WCNation[]>([]);
  const [loading, setLoading] = useState(true);
  const [confed, setConfed] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/on-the-plane/nations")
      .then((r) => r.json())
      .then((data) => {
        setNations(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = nations.filter((n) => {
    if (confed !== "ALL" && n.confederation !== confed) return false;
    if (search && !n.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Hero */}
      <div className="px-4 pt-8 pb-4 text-center max-w-3xl mx-auto">
        <div className="text-4xl mb-2">✈️</div>
        <h1
          className="text-3xl sm:text-4xl font-bold tracking-tight mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          On The Plane
        </h1>
        <p
          className="text-base sm:text-lg mb-1"
          style={{ color: "var(--text-secondary)" }}
        >
          Pick your 26-man World Cup squad. Choose your starting XI.
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Then see how your picks compare to the Chief Scout&apos;s ideal selection.
        </p>
      </div>

      {/* Filters */}
      <div className="max-w-5xl mx-auto px-4 pb-4">
        <div className="flex flex-wrap gap-2 mb-3 justify-center">
          {CONFEDERATIONS.map((c) => (
            <button
              key={c.key}
              onClick={() => setConfed(c.key)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer"
              style={{
                background:
                  confed === c.key
                    ? "var(--color-accent-personality)"
                    : "var(--bg-surface)",
                color:
                  confed === c.key
                    ? "var(--bg-base)"
                    : "var(--text-secondary)",
                border: `1px solid ${confed === c.key ? "var(--color-accent-personality)" : "var(--border-subtle)"}`,
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search nations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm mx-auto block px-3 py-2 rounded-lg text-sm"
          style={{
            background: "var(--bg-surface)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)",
          }}
        />
      </div>

      {/* Nations Grid */}
      <div className="max-w-5xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
            <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full mb-2" />
            <p className="text-sm">Loading nations...</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
            No nations found
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map((nation) => (
              <Link
                key={nation.nation_id}
                href={`/on-the-plane/${nation.slug}`}
                className="block rounded-xl p-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-2xl">{nation.kit_emoji}</span>
                  <span
                    className="text-xs font-mono px-1.5 py-0.5 rounded"
                    style={{
                      background: "var(--bg-elevated)",
                      color: "var(--text-muted)",
                    }}
                  >
                    #{nation.fifa_ranking}
                  </span>
                </div>
                <h3
                  className="text-sm font-semibold mb-1 truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {nation.name}
                </h3>
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span>{nation.confederation}</span>
                  <span>·</span>
                  <span>{nation.player_count} players</span>
                </div>
                {nation.strength !== null && (
                  <div className="mt-2">
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: "var(--bg-elevated)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${nation.strength}%`,
                          background: strengthColor(nation.strength),
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        Squad Strength
                      </span>
                      <span
                        className="text-[10px] font-mono"
                        style={{ color: strengthColor(nation.strength) }}
                      >
                        {nation.strength}
                      </span>
                    </div>
                  </div>
                )}
                {nation.total_entries > 0 && (
                  <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    {nation.total_entries} squad{nation.total_entries !== 1 ? "s" : ""} picked
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
