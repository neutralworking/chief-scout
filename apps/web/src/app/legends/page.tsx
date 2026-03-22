"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { computeAge, POSITION_COLORS } from "@/lib/types";
import { getPersonalityName } from "@/lib/personality";
import { EditableCell } from "@/components/EditableCell";
import { getArchetypeColor } from "@/lib/archetype-styles";
import { getModelLabel, MODEL_ATTRIBUTES } from "@/lib/models";
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
const PLAYING_MODELS = Object.keys(MODEL_ATTRIBUTES);

const EDITORIAL_TRAITS = [
  "set_piece_specialist", "dribble_artist", "playmaker_vision", "through_ball_king",
  "one_touch_play", "tempo_controller", "long_range_threat", "fox_in_the_box",
  "sweeper_reader", "brick_wall", "hard_man", "captain_leader",
  "target_man", "pace_merchant", "big_game_player", "clutch",
];

const TRAIT_LABELS: Record<string, string> = {
  set_piece_specialist: "Set Piece", dribble_artist: "Dribble Artist",
  playmaker_vision: "Vision", through_ball_king: "Through Ball",
  one_touch_play: "One Touch", tempo_controller: "Tempo",
  long_range_threat: "Long Range", fox_in_the_box: "Fox in the Box",
  sweeper_reader: "Reader", brick_wall: "Brick Wall",
  hard_man: "Hard Man", captain_leader: "Captain",
  target_man: "Target Man", pace_merchant: "Pace",
  big_game_player: "Big Game", clutch: "Clutch",
};

const TRAIT_COLORS: Record<string, string> = {
  style: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  tactical: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  physical: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  behavioral: "bg-green-500/20 text-green-400 border-green-500/30",
};

const TRAIT_CATEGORY: Record<string, string> = {
  set_piece_specialist: "tactical", dribble_artist: "style", playmaker_vision: "style",
  through_ball_king: "style", one_touch_play: "style", tempo_controller: "style",
  long_range_threat: "tactical", fox_in_the_box: "tactical", sweeper_reader: "tactical",
  brick_wall: "tactical", hard_man: "tactical", captain_leader: "tactical",
  target_man: "physical", pace_merchant: "physical",
  big_game_player: "behavioral", clutch: "behavioral",
};

function splitArchetype(archetype: string | null): { primary: string | null; secondary: string | null } {
  if (!archetype) return { primary: null, secondary: null };
  const parts = archetype.split("-");
  return { primary: parts[0] || null, secondary: parts[1] || null };
}

interface Legend {
  person_id: number;
  name: string;
  dob: string | null;
  nation: string | null;
  position: string | null;
  level: number | null;
  overall: number | null;
  peak: number | null;
  archetype: string | null;
  personality_type: string | null;
  best_role: string | null;
  best_role_score: number | null;
  traits: { trait: string; category: string; severity: number }[];
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

  function updateLocalArchetype(personId: number, part: "primary" | "secondary", value: string | null) {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.person_id !== personId) return p;
        const { primary, secondary } = splitArchetype(p.archetype);
        const newPrimary = part === "primary" ? value : primary;
        const newSecondary = part === "secondary" ? value : secondary;
        const newArchetype = newPrimary
          ? newSecondary ? `${newPrimary}-${newSecondary}` : newPrimary
          : null;
        return { ...p, archetype: newArchetype };
      })
    );
  }

  function SimilarActivePlayer({ personId }: { personId: number }) {
    const [similar, setSimilar] = useState<{ name: string; person_id: number; similarity: number; club: string | null } | null>(null);
    const [loaded, setLoaded] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (loaded) return;
      const el = ref.current;
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setLoaded(true);
            observer.disconnect();
          }
        },
        { rootMargin: "100px" }
      );
      observer.observe(el);
      return () => observer.disconnect();
    }, [loaded]);

    useEffect(() => {
      if (!loaded) return;
      fetch(`/api/players/${personId}/similar`)
        .then((r) => r.json())
        .then((data) => {
          const top = data.players?.[0];
          if (top) setSimilar({ name: top.name, person_id: top.person_id, similarity: top.similarity, club: top.club });
        })
        .catch(() => {});
    }, [loaded, personId]);

    return (
      <div ref={ref} className="min-w-[100px]">
        {!loaded || !similar ? (
          <span className="text-[var(--text-muted)] text-[10px]">&ndash;</span>
        ) : (
          <Link href={`/players/${similar.person_id}`} className="group flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-secondary)] group-hover:text-white transition-colors truncate max-w-[120px]">
              {similar.name}
            </span>
            <span className="text-[8px] text-[var(--text-muted)] font-mono">{Math.min(99, similar.similarity)}%</span>
          </Link>
        )}
      </div>
    );
  }

  function ArchetypeEditor({ player }: { player: Legend }) {
    const { primary, secondary } = splitArchetype(player.archetype);
    const [flash, setFlash] = useState<"saved" | "error" | null>(null);

    async function savePart(part: "primary" | "secondary", value: string | null) {
      const newPrimary = part === "primary" ? value : primary;
      const newSecondary = part === "secondary" ? value : secondary;
      const compound = newPrimary
        ? newSecondary ? `${newPrimary}-${newSecondary}` : newPrimary
        : null;
      updateLocalArchetype(player.person_id, part, value);
      try {
        const res = await fetch("/api/admin/player-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            person_id: player.person_id,
            table: "player_profiles",
            updates: { archetype: compound },
          }),
        });
        setFlash(res.ok ? "saved" : "error");
      } catch {
        setFlash("error");
      }
      setTimeout(() => setFlash(null), 600);
    }

    const secondaryOptions = PLAYING_MODELS.filter((m) => m !== (primary ?? ""));
    const borderColor = flash === "saved" ? "border-[var(--color-accent-tactical)]"
      : flash === "error" ? "border-red-400" : "border-transparent";
    const selectClass = `bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-[10px] rounded px-1 py-0.5 border ${borderColor} focus:outline-none focus:border-[var(--color-accent-tactical)]/50 cursor-pointer`;

    return (
      <div className="flex items-center gap-0.5">
        <select value={primary ?? ""} onChange={(e) => savePart("primary", e.target.value || null)} className={selectClass}>
          <option value="">Pri</option>
          {PLAYING_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="text-[var(--text-muted)] text-[8px]">&ndash;</span>
        <select value={secondary ?? ""} onChange={(e) => savePart("secondary", e.target.value || null)} className={selectClass}>
          <option value="">Sec</option>
          {secondaryOptions.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    );
  }

  function TraitPills({ player, mobile }: { player: Legend; mobile?: boolean }) {
    const [traits, setTraits] = useState(player.traits ?? []);
    const [adding, setAdding] = useState(false);

    const assigned = new Set(traits.map((t) => t.trait));
    const available = EDITORIAL_TRAITS.filter((t) => !assigned.has(t));

    async function addTrait(trait: string) {
      setTraits((prev) => [...prev, { trait, category: TRAIT_CATEGORY[trait] ?? "style", severity: 7 }]);
      setAdding(false);
      await fetch("/api/admin/trait-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: player.person_id, trait, action: "add" }),
      });
    }

    async function removeTrait(trait: string) {
      setTraits((prev) => prev.filter((t) => t.trait !== trait));
      await fetch("/api/admin/trait-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: player.person_id, trait, action: "remove" }),
      });
    }

    const pillSize = mobile ? "text-[10px] px-2 py-1" : "text-[9px] px-2 py-0.5";
    const addSelectSize = mobile ? "text-[10px]" : "text-[9px]";

    return (
      <div className="flex flex-wrap items-center gap-1">
        {traits.map((t) => (
          <span key={t.trait} className={`inline-flex items-center gap-0.5 font-medium rounded-full border ${pillSize} ${TRAIT_COLORS[t.category] ?? TRAIT_COLORS.style}`}>
            {TRAIT_LABELS[t.trait] ?? t.trait}
            {isAdmin && (
              <button onClick={() => removeTrait(t.trait)} className="ml-0.5 opacity-50 hover:opacity-100">&times;</button>
            )}
          </span>
        ))}
        {isAdmin && available.length > 0 && (
          adding ? (
            <select
              autoFocus
              onChange={(e) => { if (e.target.value) addTrait(e.target.value); }}
              onBlur={() => setAdding(false)}
              className={`${addSelectSize} bg-[var(--bg-elevated)] text-[var(--text-secondary)] rounded px-1 py-0.5 border border-[var(--border-subtle)]`}
            >
              <option value="">Pick...</option>
              {available.map((t) => <option key={t} value={t}>{TRAIT_LABELS[t] ?? t}</option>)}
            </select>
          ) : (
            <button onClick={() => setAdding(true)} className={`${addSelectSize} text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-1`}>+</button>
          )
        )}
        {traits.length === 0 && !isAdmin && <span className="text-[var(--text-muted)] text-[9px]">&ndash;</span>}
      </div>
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
                    <th className="text-left py-1.5 px-3 font-medium hidden lg:table-cell"></th>
                    <th className="text-left py-1.5 px-2 font-medium">Skillset</th>
                    <th className="text-left py-1.5 px-2 font-medium hidden lg:table-cell">Model</th>
                    <th className="text-left py-1.5 px-2 font-medium min-w-[140px]">Traits</th>
                    <th className="text-left py-1.5 px-3 font-medium hidden xl:table-cell">Best Role</th>
                    <th className="text-left py-1.5 px-3 font-medium hidden xl:table-cell">Personality</th>
                    <th className="text-right py-1.5 px-3 font-medium w-14">Peak</th>
                    <th className="text-left py-1.5 px-3 font-medium">Similar</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, idx) => {
                    const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
                    const pName = getPersonalityName(player.personality_type);
                    const { primary, secondary } = splitArchetype(player.archetype);
                    const modelLabel = getModelLabel(player.archetype);

                    return (
                      <tr key={player.person_id} className="border-b border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/30 transition-colors">
                        <td className="py-1.5 px-2 text-center">
                          <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded ${posColor} text-white`}>
                            {player.position ?? "\u2013"}
                          </span>
                        </td>
                        <td className="py-1.5 px-3">
                          <Link href={`/players/${player.person_id}`}
                            className="text-[var(--text-primary)] hover:text-white transition-colors font-medium text-xs">
                            {player.name}
                          </Link>
                        </td>
                        <td className="py-1.5 px-3 text-xs hidden lg:table-cell" title={player.nation || ""}>{player.nation ? nationFlag(player.nation) : "\u2013"}</td>
                        <td className="py-1.5 px-2 text-[10px]">
                          {isAdmin ? (
                            <ArchetypeEditor player={player} />
                          ) : (
                            <span className="text-[var(--text-secondary)]">
                              {primary ? (secondary ? `${primary}-${secondary}` : primary) : "\u2013"}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-[10px] hidden lg:table-cell">
                          {modelLabel ? (
                            <span style={{ color: getArchetypeColor(modelLabel) }} className="font-medium">{modelLabel}</span>
                          ) : <span className="text-[var(--text-muted)]">{"\u2013"}</span>}
                        </td>
                        <td className="py-1.5 px-2">
                          <TraitPills player={player} />
                        </td>
                        <td className="py-1.5 px-3 text-xs text-[var(--text-secondary)] hidden xl:table-cell">{player.best_role || "\u2013"}</td>
                        <td className="py-1.5 px-3 text-xs text-purple-400 hidden xl:table-cell">
                          {pName || "\u2013"}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          {isAdmin ? (
                            <EditableCell value={player.peak} personId={player.person_id} field="peak" table="player_profiles" rowIndex={idx} onSaved={(v) => updateLocal(player.person_id, "peak", v)} />
                          ) : (
                            <span className={`font-mono font-bold text-sm ${peakColor(player.peak)}`}>{player.peak ?? "\u2013"}</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-xs">
                          <SimilarActivePlayer personId={player.person_id} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]/30">
              {players.map((player, idx) => {
                const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
                const modelLabel = getModelLabel(player.archetype);
                return (
                  <div key={player.person_id} className="px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${posColor} text-white shrink-0`}>
                          {player.position ?? "\u2013"}
                        </span>
                        <Link href={`/players/${player.person_id}`} className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                            {player.name}
                            {player.nation && <span className="text-[11px] ml-1">{nationFlag(player.nation)}</span>}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] truncate">
                            {modelLabel ? <span style={{ color: getArchetypeColor(modelLabel) }}>{modelLabel}</span> : player.archetype || "\u2013"}
                            {" \u00B7 "}{player.best_role || "\u2013"}
                          </p>
                        </Link>
                      </div>
                      <div className="text-center px-1.5 py-0.5 rounded bg-[var(--bg-elevated)]">
                        <span className="text-[7px] text-[var(--text-muted)] block leading-none mb-0.5">Peak</span>
                        {isAdmin ? (
                          <EditableCell value={player.peak} personId={player.person_id} field="peak" table="player_profiles" rowIndex={idx} onSaved={(v) => updateLocal(player.person_id, "peak", v)} />
                        ) : (
                          <span className={`font-mono text-xs font-bold ${peakColor(player.peak)}`}>{player.peak ?? "\u2013"}</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 pl-9">
                      <TraitPills player={player} mobile />
                    </div>
                    <div className="mt-1.5 pl-9 flex items-center gap-1">
                      <span className="text-[10px] text-[var(--text-muted)] shrink-0">{"\u21B3"} Plays like:</span>
                      <SimilarActivePlayer personId={player.person_id} />
                    </div>
                  </div>
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
