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
      <div className="px-4 pt-10 pb-6 text-center max-w-3xl mx-auto">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4 opacity-80">
          <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z" fill="url(#otp-grad)"/>
          <defs>
            <linearGradient id="otp-grad" x1="2" y1="3" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#e91e8c"/>
              <stop offset="0.5" stopColor="#ff6b35"/>
              <stop offset="1" stopColor="#fbbf24"/>
            </linearGradient>
          </defs>
        </svg>
        <h1
          className="text-3xl sm:text-4xl font-bold uppercase tracking-[3px] mb-3"
          style={{
            fontFamily: "var(--font-display)",
            background: "var(--gradient-brand)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          On The Plane
        </h1>
        <p className="text-sm sm:text-base mb-1" style={{ color: "var(--text-secondary)" }}>
          Pick your 26-man World Cup squad. Choose your starting XI.
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
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
            {filtered.map((nation) => {
              const thinPool = nation.player_count < 11;
              const tierColor = strengthColor(nation.strength);
              const cardContent = (
                <>
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-3xl leading-none">{nation.kit_emoji}</span>
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border-subtle)",
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
                  <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    <span>{nation.confederation}</span>
                    {nation.total_entries > 0 && (
                      <>
                        <span>·</span>
                        <span>{nation.total_entries} picked</span>
                      </>
                    )}
                  </div>
                  {thinPool && (
                    <p className="text-[10px] mt-2" style={{ color: "var(--color-accent-physical)" }}>
                      Not enough scouted players yet
                    </p>
                  )}
                  {nation.strength !== null && (
                    <div className="mt-3">
                      <div
                        className="h-1 rounded-full overflow-hidden"
                        style={{ background: "var(--bg-elevated)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${nation.strength}%`,
                            background: tierColor,
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          Strength
                        </span>
                        <span
                          className="text-[10px] font-mono font-bold"
                          style={{ color: tierColor }}
                        >
                          {nation.strength}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              );

              const cardStyle = {
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderLeft: thinPool ? undefined : `3px solid ${tierColor}`,
              };

              return thinPool ? (
                <div
                  key={nation.nation_id}
                  className="block rounded-xl p-4 opacity-40 cursor-not-allowed"
                  style={cardStyle}
                >
                  {cardContent}
                </div>
              ) : (
                <Link
                  key={nation.nation_id}
                  href={`/on-the-plane/${nation.slug}`}
                  className="block rounded-xl p-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={cardStyle}
                >
                  {cardContent}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
