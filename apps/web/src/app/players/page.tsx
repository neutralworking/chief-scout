"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { PlayerCard as PlayerCardType, computeAge, POSITION_COLORS, PURSUIT_COLORS } from "@/lib/types";
import { EditableCell } from "@/components/EditableCell";
import Link from "next/link";

const PAGE_SIZES = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 100;

const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];
const PURSUIT_STATUSES = ["Priority", "Interested", "Scout Further", "Watch", "Monitor", "Pass"];

const POSITION_SHORT: Record<string, string> = {
  GK: "GK", WD: "WD", CD: "CD", DM: "DM", CM: "CM", WM: "WM", AM: "AM", WF: "WF", CF: "CF",
};

function fmtValue(eur: number | null | undefined): string {
  if (eur == null || eur <= 0) return "–";
  if (eur >= 1_000_000) return `€${(eur / 1_000_000).toFixed(1)}m`;
  if (eur >= 1_000) return `€${(eur / 1_000).toFixed(0)}k`;
  return `€${eur}`;
}

function fmtMeur(meur: number | null | undefined): string {
  if (meur == null || meur <= 0) return "–";
  return `€${meur.toFixed(1)}m`;
}

function ratingColor(level: number | null): string {
  if (level == null) return "text-[var(--text-muted)]";
  if (level >= 85) return "text-amber-400";
  if (level >= 78) return "text-green-400";
  if (level >= 70) return "text-[var(--text-primary)]";
  return "text-[var(--text-secondary)]";
}

// Extend PlayerCard with stats fields
interface PlayerRow extends PlayerCardType {
  overall: number | null;
}

// Nation → flag emoji (2-letter ISO → regional indicator symbols)
const NATION_FLAGS: Record<string, string> = {};
function nationFlag(nation: string | null | undefined): string {
  if (!nation) return "";
  if (NATION_FLAGS[nation]) return NATION_FLAGS[nation];
  // Common nation name → ISO 2-letter mapping
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
  // England/Scotland/Wales use subdivision tag sequences (🏴 + tag chars + cancel tag)
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

// ── Debounced search input ───────────────────────────────────────────────────
function SearchInput({ value, onChange, onSearch }: { value: string; onChange: (v: string) => void; onSearch: (v: string) => void }) {
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    onChange(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (val.length === 0 || val.length >= 2) onSearch(val);
    }, 350);
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder="Search players..."
      className="flex-1 px-2.5 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--color-accent-personality)]"
    />
  );
}

function PlayersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [autoScroll, setAutoScroll] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginPass, setLoginPass] = useState("");

  const position = searchParams.get("position") ?? "";
  const pursuit = searchParams.get("pursuit") ?? "";
  const q = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "level_raw";
  const tier = searchParams.get("tier") ?? "";

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem("network_admin") === "1");
  }, []);

  function handleLogin() {
    if (loginPass === "0.123456789") {
      sessionStorage.setItem("network_admin", "1");
      setIsAdmin(true);
      setShowLogin(false);
      setLoginPass("");
    }
  }

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    router.push(`/players?${params.toString()}`);
  }, [router, searchParams]);

  const buildUrl = useCallback((offset: number) => {
    const params = new URLSearchParams();
    if (position) params.set("position", position);
    if (pursuit) params.set("pursuit", pursuit);
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    if (tier) params.set("tier", tier);
    params.set("limit", String(pageSize));
    params.set("offset", String(offset));
    params.set("stats", "1");
    return `/api/players/all?${params}`;
  }, [position, pursuit, q, sort, tier, pageSize]);

  // Reset page when filters or page size change
  useEffect(() => { setPage(0); }, [position, pursuit, q, sort, tier, pageSize]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(buildUrl(page * pageSize));
        if (!res.ok) { setError(`Failed: ${res.statusText}`); setLoading(false); return; }
        const data = await res.json();
        if (!cancelled) {
          // In autoScroll mode on page > 0, append instead of replace
          if (autoScroll && page > 0) {
            setPlayers((prev) => [...prev, ...(data.players ?? [])]);
          } else {
            setPlayers(data.players ?? []);
          }
          setHasMore(data.hasMore ?? false);
        }
      } catch (e) { if (!cancelled) setError(String(e)); }
      if (!cancelled) { setLoading(false); setLoadingMore(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [buildUrl, page, autoScroll, pageSize]);

  // Infinite scroll: IntersectionObserver on sentinel
  useEffect(() => {
    if (!autoScroll || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          setLoadingMore(true);
          setPage((p) => p + 1);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [autoScroll, hasMore, loading, loadingMore]);

  // Reset players when toggling autoScroll off
  function toggleAutoScroll() {
    if (autoScroll) {
      setAutoScroll(false);
      setPage(0);
    } else {
      setAutoScroll(true);
      setPage(0);
    }
  }

  useEffect(() => { setSearchInput(q); }, [q]);

  // Update a player's field in local state after inline edit
  function updateLocal(personId: number, field: string, value: number) {
    setPlayers((prev) =>
      prev.map((p) => (p.person_id === personId ? { ...p, [field]: value } : p))
    );
  }

  const hasFilters = !!(position || pursuit || q || tier);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-2rem)]">
      {/* Header + Filters — fixed */}
      <div className="shrink-0">
        {/* Title + admin */}
        <div className="flex items-center gap-2 mb-1.5">
          <h1 className="text-lg font-bold tracking-tight">Players</h1>
          {!isAdmin ? (
            <button
              onClick={() => setShowLogin(!showLogin)}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              title="Admin login"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </button>
          ) : (
            <span className="text-[10px] text-[var(--color-accent-tactical)]" title="Editing enabled">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </span>
          )}
          {showLogin && (
            <input
              type="password"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
              placeholder="PIN"
              className="w-20 px-2 py-0.5 text-[10px] rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-accent-tactical)]"
              autoFocus
            />
          )}
          {/* Pagination — right side */}
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <button
              onClick={toggleAutoScroll}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                autoScroll
                  ? "bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)] border border-[var(--color-accent-tactical)]/30"
                  : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
              }`}
              title="Infinite scroll"
            >
              Auto
            </button>
            {!autoScroll && (
              <>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="text-[10px] font-mono px-1 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)]"
                >
                  {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0 || loading}
                  className="px-1.5 py-0.5 text-[10px] glass rounded text-[var(--text-secondary)] disabled:opacity-30">&larr;</button>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">
                  {loading ? "..." : `${page * pageSize + 1}–${page * pageSize + players.length}`}
                </span>
                <button onClick={() => setPage(page + 1)} disabled={!hasMore || loading}
                  className="px-1.5 py-0.5 text-[10px] glass rounded text-[var(--text-secondary)] disabled:opacity-30">&rarr;</button>
              </>
            )}
            {autoScroll && (
              <span className="text-[10px] font-mono text-[var(--text-muted)]">{players.length}</span>
            )}
          </div>
        </div>

        {/* Compact controls */}
        <div className="glass rounded-lg p-1.5 mb-2 overflow-hidden">
          {/* Row 1: Position pills — scrollable on mobile */}
          <div className="flex items-center gap-1 mb-1 overflow-x-auto scrollbar-none">
            <div className="flex gap-0.5 shrink-0">
              <button onClick={() => updateParam("position", "")}
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap transition-colors ${
                  !position ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}>
                ALL
              </button>
              {POSITIONS.map((pos) => (
                <button key={pos} onClick={() => updateParam("position", position === pos ? "" : pos)}
                  className={`text-[9px] font-bold px-1 py-0.5 rounded whitespace-nowrap transition-colors ${
                    position === pos ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}>
                  {pos}
                </button>
              ))}
            </div>
            <div className="flex gap-1 shrink-0 ml-auto">
              <select value={sort} onChange={(e) => updateParam("sort", e.target.value)}
                className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[10px]">
                <option value="role_score">Role Score</option>
                <option value="level">Overall</option>
                <option value="level_raw">Level</option>
                <option value="review">Review</option>
                <option value="cs_value">CS Value</option>
                <option value="tm_value">TM Value</option>
                <option value="rating">Rating</option>
                <option value="name">Name</option>
              </select>
              <select value={pursuit} onChange={(e) => updateParam("pursuit", e.target.value)}
                className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[10px]">
                <option value="">Status</option>
                {PURSUIT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={tier} onChange={(e) => updateParam("tier", e.target.value)}
                className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[10px]">
                <option value="">Tier</option>
                <option value="1">T1</option>
                <option value="2">T2</option>
              </select>
            </div>
          </div>
          {/* Row 2: Search + clear */}
          <div className="flex gap-1">
            <div className="flex-1">
              <SearchInput value={searchInput} onChange={setSearchInput} onSearch={(val) => updateParam("q", val)} />
            </div>
            {hasFilters && (
              <button onClick={() => { setSearchInput(""); router.push("/players"); }}
                className="px-1.5 py-0.5 rounded text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0">
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table — fills remaining viewport */}
      <div className="flex-1 min-h-0 flex flex-col">
        {!loading && !error && players.length > 0 && (
          <div className="glass rounded-xl overflow-hidden flex-1 min-h-0 flex flex-col">
            {/* Desktop table */}
            <div className="flex-1 overflow-y-auto hidden sm:block">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--bg-surface)] z-10">
                  <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                    <th className="text-left py-1.5 px-3 font-medium w-10">Pos</th>
                    <th className="text-left py-1.5 px-3 font-medium">Player</th>
                    <th className="text-left py-1.5 px-3 font-medium hidden lg:table-cell">Best Role</th>
                    <th className="text-right py-1.5 px-3 font-medium w-14">Score</th>
                    <th className="text-right py-1.5 px-3 font-medium w-14">Lvl</th>
                    <th className="text-right py-1.5 px-3 font-medium w-16">CS Val</th>
                    <th className="text-right py-1.5 px-3 font-medium w-16 hidden lg:table-cell">TM Val</th>
                    <th className="text-right py-1.5 px-3 font-medium w-10 hidden lg:table-cell">App</th>
                    <th className="text-right py-1.5 px-3 font-medium w-10 hidden lg:table-cell">G</th>
                    <th className="text-right py-1.5 px-3 font-medium w-10 hidden lg:table-cell">A</th>
                    <th className="text-right py-1.5 px-3 font-medium w-12 hidden lg:table-cell">xG</th>
                    <th className="text-right py-1.5 px-3 font-medium w-12 hidden lg:table-cell">Rtg</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, idx) => {
                    const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";

                    return (
                      <tr key={player.person_id} className="border-b border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/30 transition-colors">
                        <td className="py-1.5 px-3">
                          <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white`}>
                            {player.position ?? "–"}
                          </span>
                        </td>
                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <Link href={`/players/${player.person_id}`}
                              className="text-[var(--text-primary)] hover:text-white transition-colors font-medium text-xs">
                              {player.name}
                            </Link>
                            {player.dob && (
                              <span className="text-[9px] text-[var(--text-muted)] font-mono">{computeAge(player.dob)}</span>
                            )}
                            {player.nation && (
                              <span className="text-[10px]" title={player.nation}>{nationFlag(player.nation)}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-[var(--text-muted)]">{player.club || ""}</span>
                        </td>
                        <td className="py-1.5 px-3 text-xs text-[var(--text-secondary)] hidden lg:table-cell">{player.best_role || "–"}</td>
                        <td className="py-1.5 px-3 text-right">
                          {isAdmin ? (
                            <EditableCell
                              value={player.best_role_score}
                              personId={player.person_id}
                              field="best_role_score"
                              table="player_profiles"
                              rowIndex={idx}
                              min={1}
                              max={99}
                              onSaved={(v) => updateLocal(player.person_id, "best_role_score", v)}
                            />
                          ) : (
                            <span className={`font-mono text-xs font-bold ${ratingColor(player.best_role_score)}`}>
                              {player.best_role_score ?? "–"}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          {isAdmin ? (
                            <EditableCell
                              value={player.level}
                              personId={player.person_id}
                              field="level"
                              table="player_profiles"
                              rowIndex={idx}
                              min={1}
                              max={99}
                              onSaved={(v) => updateLocal(player.person_id, "level", v)}
                            />
                          ) : (
                            <span className={`font-mono text-xs ${ratingColor(player.level)}`}>
                              {player.level ?? "–"}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-xs text-[var(--color-accent-tactical)]">
                          {fmtMeur(player.director_valuation_meur)}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-xs text-[var(--text-secondary)] hidden lg:table-cell">
                          {fmtValue(player.market_value_eur)}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-[10px] text-[var(--text-muted)] hidden lg:table-cell">
                          {player.apps ?? "–"}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-[10px] text-[var(--text-muted)] hidden lg:table-cell">
                          {player.goals ?? "–"}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-[10px] text-[var(--text-muted)] hidden lg:table-cell">
                          {player.assists ?? "–"}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-[10px] text-[var(--text-muted)] hidden lg:table-cell">
                          {player.xg ?? "–"}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-[10px] hidden lg:table-cell">
                          {player.rating != null ? (
                            <span className="text-amber-400">{player.rating.toFixed(2)}</span>
                          ) : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]/30">
              {players.map((player, idx) => {
                const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";

                return (
                  <div key={player.person_id} className="px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${posColor} text-white shrink-0`}>
                          {player.position ?? "–"}
                        </span>
                        <Link href={`/players/${player.person_id}`} className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                            {player.name}
                            {player.dob && <span className="text-[10px] text-[var(--text-muted)] font-mono ml-1">{computeAge(player.dob)}</span>}
                            {player.nation && <span className="text-[10px] ml-1" title={player.nation}>{nationFlag(player.nation)}</span>}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] truncate">{player.club || ""}</p>
                          {(player.goals != null || player.assists != null) && (
                            <p className="text-[10px] font-mono text-[var(--text-muted)]">
                              {player.goals != null && <span className="text-green-400">{player.goals}G</span>}
                              {player.goals != null && player.assists != null && " "}
                              {player.assists != null && <span className="text-blue-400">{player.assists}A</span>}
                              {player.rating != null && <span className="text-amber-400"> · {player.rating.toFixed(1)}★</span>}
                            </p>
                          )}
                        </Link>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        {fmtMeur(player.director_valuation_meur) !== "–" && (
                          <span className="text-[10px] font-mono text-[var(--color-accent-tactical)]">
                            {fmtMeur(player.director_valuation_meur)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Data row: Role + scores */}
                    <div className="flex items-center justify-between mt-1 pl-7">
                      <span className="text-[10px] text-[var(--text-secondary)] truncate max-w-[120px]">
                        {player.best_role || "–"}
                      </span>
                      <div className="flex items-center gap-1">
                        <div className="text-center px-1.5 py-0.5 rounded bg-[var(--bg-elevated)]">
                          <span className="text-[7px] text-[var(--text-muted)] block leading-none mb-0.5">Role</span>
                          {isAdmin ? (
                            <EditableCell
                              value={player.best_role_score}
                              personId={player.person_id}
                              field="best_role_score"
                              table="player_profiles"
                              rowIndex={idx}
                              min={1}
                              max={99}
                              onSaved={(v) => updateLocal(player.person_id, "best_role_score", v)}
                            />
                          ) : (
                            <span className={`font-mono text-xs font-bold ${ratingColor(player.best_role_score)}`}>
                              {player.best_role_score ?? "–"}
                            </span>
                          )}
                        </div>
                        <div className="text-center px-1.5 py-0.5">
                          <span className="text-[7px] text-[var(--text-muted)] block leading-none mb-0.5">Lvl</span>
                          {isAdmin ? (
                            <EditableCell
                              value={player.level}
                              personId={player.person_id}
                              field="level"
                              table="player_profiles"
                              rowIndex={idx}
                              min={1}
                              max={99}
                              onSaved={(v) => updateLocal(player.person_id, "level", v)}
                            />
                          ) : (
                            <span className={`font-mono text-xs ${ratingColor(player.level)}`}>
                              {player.level ?? "–"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Infinite scroll sentinel + loading indicator */}
            {autoScroll && hasMore && (
              <div ref={sentinelRef} className="py-3 text-center">
                {loadingMore && <p className="text-[10px] text-[var(--text-muted)]">Loading more...</p>}
              </div>
            )}
            {autoScroll && !hasMore && players.length > 0 && (
              <p className="text-[10px] text-[var(--text-muted)] py-2 text-center">All players loaded</p>
            )}
          </div>
        )}

        {/* Loading state */}
        {loading && !loadingMore && (
          <div className="glass rounded-xl py-12 text-center flex-1">
            <p className="text-sm text-[var(--text-muted)]">Loading players...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="glass rounded-xl p-4">
            <p className="text-sm text-[var(--color-sentiment-negative)]">{error}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && players.length === 0 && (
          <div className="glass rounded-xl py-12 text-center flex-1">
            <p className="text-sm text-[var(--text-muted)]">
              {hasFilters ? "No players match the current filters." : "No player data found."}
            </p>
          </div>
        )}
      </div>

    </div>
  );
}

export default function PlayersPage() {
  return (
    <Suspense fallback={<div className="text-[var(--text-muted)] text-sm">Loading...</div>}>
      <PlayersContent />
    </Suspense>
  );
}
