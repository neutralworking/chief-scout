"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { computeAge, POSITION_COLORS } from "@/lib/types";
import { getPersonalityName } from "@/lib/personality";
import { EditableCell } from "@/components/EditableCell";
import Link from "next/link";

const NATION_FLAGS: Record<string, string> = {};
function nationFlag(nation: string | null | undefined): string {
  if (!nation) return "";
  if (NATION_FLAGS[nation]) return NATION_FLAGS[nation];
  const ISO: Record<string, string> = {
    "Argentina": "AR", "Australia": "AU", "Austria": "AT", "Belgium": "BE", "Brazil": "BR",
    "Cameroon": "CM", "Canada": "CA", "Chile": "CL", "Colombia": "CO", "Croatia": "HR",
    "Czech Republic": "CZ", "Czechia": "CZ", "Denmark": "DK", "Ecuador": "EC", "Egypt": "EG",
    "England": "GB-ENG", "France": "FR", "Germany": "DE", "Ghana": "GH", "Greece": "GR",
    "Hungary": "HU", "Iceland": "IS", "Iran": "IR", "Ireland": "IE", "Israel": "IL",
    "Italy": "IT", "Ivory Coast": "CI", "Jamaica": "JM", "Japan": "JP", "Mali": "ML",
    "Mexico": "MX", "Morocco": "MA", "Netherlands": "NL", "Nigeria": "NG", "North Macedonia": "MK",
    "Norway": "NO", "Paraguay": "PY", "Peru": "PE", "Poland": "PL", "Portugal": "PT",
    "Republic of Ireland": "IE", "Romania": "RO", "Russia": "RU", "Scotland": "GB-SCT",
    "Senegal": "SN", "Serbia": "RS", "Slovakia": "SK", "Slovenia": "SI", "South Korea": "KR",
    "Spain": "ES", "Sweden": "SE", "Switzerland": "CH", "Turkey": "TR", "Ukraine": "UA",
    "United States": "US", "Uruguay": "UY", "Venezuela": "VE", "Wales": "GB-WLS",
    "Algeria": "DZ", "Tunisia": "TN", "DR Congo": "CD", "Guinea": "GN", "Gabon": "GA",
    "Burkina Faso": "BF", "Togo": "TG", "Benin": "BJ", "Niger": "NE", "Chad": "TD",
    "Congo": "CG", "Costa Rica": "CR", "Honduras": "HN", "Panama": "PA", "Georgia": "GE",
    "Armenia": "AM", "Albania": "AL", "Bosnia and Herzegovina": "BA", "Montenegro": "ME",
    "Kosovo": "XK", "Finland": "FI", "New Zealand": "NZ", "China": "CN", "India": "IN",
  };
  const code = ISO[nation];
  if (!code) { NATION_FLAGS[nation] = nation.slice(0, 3); return NATION_FLAGS[nation]; }
  const GB_FLAGS: Record<string, string> = {
    "GB-ENG": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F",
    "GB-SCT": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F",
    "GB-WLS": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73\uDB40\uDC7F",
  };
  if (GB_FLAGS[code]) { NATION_FLAGS[nation] = GB_FLAGS[code]; return NATION_FLAGS[nation]; }
  const flag = String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  NATION_FLAGS[nation] = flag;
  return flag;
}

const PAGE_SIZE = 50;
const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];

interface Legend {
  person_id: number;
  name: string;
  dob: string | null;
  nation: string | null;
  club: string | null;
  position: string | null;
  level: number | null;
  overall: number | null;
  peak: number | null;
  archetype: string | null;
  personality_type: string | null;
  best_role: string | null;
  best_role_score: number | null;
}

function peakColor(peak: number | null): string {
  if (peak == null) return "text-[var(--text-muted)]";
  if (peak >= 90) return "text-amber-400";
  if (peak >= 85) return "text-green-400";
  if (peak >= 80) return "text-blue-400";
  if (peak >= 70) return "text-[var(--text-secondary)]";
  return "text-[var(--text-muted)]";
}

function LegendsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [players, setPlayers] = useState<Legend[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem("network_admin") === "1");
  }, []);

  function updateLocal(personId: number, field: string, value: number) {
    setPlayers((prev) =>
      prev.map((p) => (p.person_id === personId ? { ...p, [field]: value } : p))
    );
  }

  const position = searchParams.get("position") ?? "";
  const q = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "peak";

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    router.push(`/legends?${params.toString()}`);
  }, [searchParams, router]);

  const buildUrl = useCallback((offset: number) => {
    const params = new URLSearchParams();
    if (position) params.set("position", position);
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));
    return `/api/legends?${params}`;
  }, [position, q, sort]);

  useEffect(() => { setPage(0); }, [position, q, sort]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(buildUrl(page * PAGE_SIZE));
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        if (!cancelled) {
          setPlayers(data.players ?? []);
          setHasMore(data.hasMore ?? false);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [buildUrl, page]);

  useEffect(() => { setSearchInput(q); }, [q]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-lg font-bold tracking-tight">Legends</h1>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => updateParam("position", "")}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                !position ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
                  : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
              }`}>
              All
            </button>
            {POSITIONS.map((pos) => (
              <button key={pos} onClick={() => updateParam("position", position === pos ? "" : pos)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                  position === pos ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
                    : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
                }`}>
                {pos}
              </button>
            ))}
          </div>
          {/* Pagination */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0 || loading}
              className="px-2 py-0.5 text-[10px] font-medium glass rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30">&larr;</button>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {loading ? "..." : `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + players.length}`}
            </span>
            <button onClick={() => setPage(page + 1)} disabled={!hasMore || loading}
              className="px-2 py-0.5 text-[10px] font-medium glass rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30">&rarr;</button>
          </div>
        </div>

        {/* Filters */}
        <div className="glass rounded-lg p-2 mb-2 flex flex-col sm:flex-row gap-1.5">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              const val = e.target.value;
              setTimeout(() => {
                if (val.length === 0 || val.length >= 2) updateParam("q", val);
              }, 300);
            }}
            placeholder="Search legends..."
            className="flex-1 px-2.5 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--color-accent-personality)]"
          />
          <select value={sort} onChange={(e) => updateParam("sort", e.target.value)}
            className="px-2.5 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs">
            <option value="peak">Peak</option>
            <option value="role_score">Role Score</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 flex flex-col">
        {!loading && players.length > 0 && (
          <div className="glass rounded-xl overflow-hidden flex-1 min-h-0 flex flex-col">
            {/* Desktop table */}
            <div className="flex-1 overflow-y-auto hidden sm:block">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--bg-surface)] z-10">
                  <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                    <th className="text-center py-1.5 px-2 font-medium w-10">Pos</th>
                    <th className="text-left py-1.5 px-3 font-medium">Player</th>
                    <th className="text-left py-1.5 px-3 font-medium">Last Club</th>
                    <th className="text-left py-1.5 px-3 font-medium hidden lg:table-cell"></th>
                    <th className="text-left py-1.5 px-3 font-medium hidden xl:table-cell">Archetype</th>
                    <th className="text-left py-1.5 px-3 font-medium hidden lg:table-cell">Best Role</th>
                    <th className="text-left py-1.5 px-3 font-medium hidden xl:table-cell">Personality</th>
                    <th className="text-right py-1.5 px-3 font-medium w-14">Peak</th>
                    <th className="text-right py-1.5 px-3 font-medium w-14">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, idx) => {
                    const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
                    const pName = getPersonalityName(player.personality_type);

                    return (
                      <tr key={player.person_id} className="border-b border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/30 transition-colors">
                        <td className="py-1.5 px-2 text-center">
                          <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded ${posColor} text-white`}>
                            {player.position ?? "–"}
                          </span>
                        </td>
                        <td className="py-1.5 px-3">
                          <Link href={`/players/${player.person_id}`}
                            className="text-[var(--text-primary)] hover:text-white transition-colors font-medium text-xs">
                            {player.name}
                          </Link>
                        </td>
                        <td className="py-1.5 px-3 text-xs text-[var(--text-secondary)]">{player.club || "–"}</td>
                        <td className="py-1.5 px-3 text-xs hidden lg:table-cell" title={player.nation || ""}>{player.nation ? nationFlag(player.nation) : "–"}</td>
                        <td className="py-1.5 px-3 text-xs text-[var(--text-secondary)] hidden xl:table-cell">{player.archetype || "–"}</td>
                        <td className="py-1.5 px-3 text-xs text-[var(--text-secondary)] hidden lg:table-cell">{player.best_role || "–"}</td>
                        <td className="py-1.5 px-3 text-xs text-purple-400 hidden xl:table-cell">
                          {pName || "–"}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          {isAdmin ? (
                            <EditableCell value={player.peak} personId={player.person_id} field="peak" table="player_profiles" rowIndex={idx} onSaved={(v) => updateLocal(player.person_id, "peak", v)} />
                          ) : (
                            <span className={`font-mono font-bold text-sm ${peakColor(player.peak)}`}>{player.peak ?? "–"}</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          {isAdmin ? (
                            <EditableCell value={player.best_role_score} personId={player.person_id} field="best_role_score" table="player_profiles" rowIndex={idx} onSaved={(v) => updateLocal(player.person_id, "best_role_score", v)} />
                          ) : (
                            <span className={`font-mono text-xs ${peakColor(player.best_role_score)}`}>{player.best_role_score ?? "–"}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden flex-1 overflow-y-auto space-y-0.5 p-1">
              {players.map((player) => {
                const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
                return (
                  <Link key={player.person_id} href={`/players/${player.person_id}`}
                    className="rounded-lg p-2.5 flex items-center justify-between hover:bg-[var(--bg-elevated)]/50 transition-colors block">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${posColor} text-white shrink-0`}>
                        {player.position ?? "–"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{player.name}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {player.club || "Unknown"}
                          {player.nation && <span className="ml-1">{nationFlag(player.nation)}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {player.best_role && (
                        <span className="text-[10px] text-[var(--text-secondary)]">{player.best_role}</span>
                      )}
                      <span className={`text-base font-mono font-bold ${peakColor(player.peak)}`}>
                        {player.peak ?? "–"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {loading && (
          <div className="glass rounded-xl py-12 text-center flex-1">
            <p className="text-sm text-[var(--text-muted)]">Loading legends...</p>
          </div>
        )}

        {!loading && players.length === 0 && (
          <div className="glass rounded-xl py-12 text-center flex-1">
            <p className="text-sm text-[var(--text-muted)]">
              {q || position ? "No legends match the current filters." : "No retired players found."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LegendsPage() {
  return (
    <Suspense fallback={<div className="text-[var(--text-muted)] text-sm">Loading...</div>}>
      <LegendsContent />
    </Suspense>
  );
}
