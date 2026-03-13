"use client";
import { useEffect, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Player {
  id: number; name: string; club: string | null; division: string | null;
  nation: string | null; position: string | null; secondary_position: string | null;
  level: number | null; peak: number | null;
  archetype: string | null; archetype_override: string | null;
  scarcity_score: number | null;
  national_scarcity: number | null; market_premium: number | null;
  scouting_notes: string | null;
  pursuit_status: "Pass" | "Watch" | "Interested" | "Priority" | null;
  director_valuation_meur: number | null;
  fit_note: string | null;
  // Legacy fields — will be null until migrated to dedicated endpoints
  Character?: string | null;
  Mentality?: string | null; Foot?: string | null;
  Physique?: string | null; model?: string | null;
  primary?: string | null; secondary?: string | null;
}

interface DofDraft {
  pursuit_status?: "Pass" | "Watch" | "Interested" | "Priority" | "";
  director_valuation_meur?: number | null;
  fit_note?: string;
  scouting_notes?: string;
}

interface DataDraft {
  position?: string; secondary_position?: string;
  level?: number; peak?: number;
  traits?: string[]; Mentality?: string; Foot?: string; Physique?: string;
  model?: string; primary?: string; secondary?: string;
  archetype_override?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TRAITS = [
  "Aggressive","Antagonistic","Charismatic","Classy","Combative","Committed",
  "Competitive","Composed","Crafty","Determined","Eccentric","Energetic",
  "Flamboyant","Focused","Icy","Industrious","Influential","Intelligent",
  "Mercurial","No-Nonsense","Passionate","Physical","Relentless","Reliable",
  "Resolute","Talismanic","Tenacious","Tireless","Unpredictable",
];

const MENTALITIES = ["Attacking", "Balanced", "Cautious"];
const FEET = ["Right", "Left", "Either"];
const PHYSIQUES = ["Powerful","Robust","Dynamic","Athletic","Speedy","Agile","Nimble","Balanced","Rapid","Tall"];

const ARCHETYPES = [
  "The Superstar","The Serial Winner","The Prestige Seeker","The Mercenary",
  "The Veteran Pro","The Project Builder","The Loyalist","The Tactician",
  "The Entertainer","The Journeyman",
];

const CLASSES = [
  "Engine","Sprinter","Creator","Stopper","Aerial","Striker","Controller",
  "Powerhouse","Dribbler","Acrobat","Cover","Commander","Passer",
  "Guardian","Distributor","Orthodox","Athlete","Playmaker","Winger",
];

const MODELS = [
  "All-Rounder","Anchor","Architect","Assassin","Athlete","Attacker","Barrier",
  "Bison","Boxcrasher","Box-To-Box","Bulldozer","Carrier","Catalyst","Centre Back",
  "Colossus","Conductor","Cornerback","Craque","Custodian","Destroyer","Director",
  "Disruptor","Dominator","Driver","Dynamo","Enforcer","Fantasista","Finisher",
  "Flanker","Flash","General","Ghost","Gladiator","Glove","Guardian","Halfback",
  "Hammer","Hawk","Heartbeat","Hitman","Hurricane","Juggernaut","Leader","Libero",
  "Libero GK","Livewire","Lynchpin","Machine","Maestro","Magician","Marksman",
  "Mastermind","Menace","Metronome","Orchestrator","Outlet","Panther","Playmaker",
  "Poacher","Point Guard","Protector","Provider","Radar","Raider","Ranger",
  "Raumdeuter","Regista","Rifle","Rock","Rocket","Safeguard","Safety","Sentinel",
  "Sentry","Shadow","Shield","Shotstopper","Shuttler","Skipper","Sniper","Spark",
  "Spearhead","Spider","Stalwart","Sweeper","Talisman","Tank","Target","Terrier",
  "Titan","Tornate","Train","Volante","Wall","Winger","Wizard","Workhorse",
];

const POS_GRID = [["WF","CF","WM"],["AM","CM","DM"],["WD","CD","GK"]];

const PURSUIT_OPTIONS = [
  { value: "Pass",       label: "Pass",     cls: "pursuit-pass" },
  { value: "Watch",      label: "Watch",    cls: "pursuit-watch" },
  { value: "Interested", label: "Interested", cls: "pursuit-interested" },
  { value: "Priority",   label: "Priority", cls: "pursuit-priority" },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function normFoot(f: string | null) {
  if (!f) return null;
  const u = f.trim().toUpperCase();
  if (u === "R" || u === "RIGHT") return "Right";
  if (u === "L" || u === "LEFT")  return "Left";
  if (u === "E" || u === "EITHER" || u === "BOTH") return "Either";
  return f;
}

function tierLabel(v: number) {
  if (v >= 90) return "World Class";
  if (v >= 86) return "Elite";
  if (v >= 82) return "Top Flight";
  if (v >= 78) return "Championship";
  return "Lower League";
}

function dots(score: number | null, max = 5) {
  if (!score) return null;
  return Array.from({ length: max }, (_, i) => (
    <span key={i} className={i < score ? "dot dot-on" : "dot dot-off"} />
  ));
}

function scarcityHint(scarcity: number | null, premium: number | null): string {
  if (!scarcity) return "";
  const parts: string[] = [];
  if (scarcity >= 4) parts.push("scarce — expect premium");
  else if (scarcity >= 3) parts.push("uncommon supply");
  else parts.push("abundant supply");
  if (premium && premium > 0) parts.push(`+${premium} market premium`);
  else if (premium && premium < 0) parts.push(`${premium} undervalued`);
  return parts.join(" · ");
}

// ── Small components ──────────────────────────────────────────────────────────

function PosGrid({ value, onChange }: { value: string | null | undefined; onChange: (p: string) => void }) {
  return (
    <div className="pitch-wrap">
      <div className="pitch-grid">
        {POS_GRID.flat().map(pos => (
          <button key={pos} className={`pos-btn${value === pos ? " sel" : ""}`}
            onClick={() => onChange(pos === value ? "" : pos)}>{pos}</button>
        ))}
      </div>
    </div>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: number) => void }) {
  const v = value ?? 80;
  return (
    <div>
      <div className="pill-sublabel">{label}</div>
      <div className="level-block">
        <button className="step-btn" onClick={() => onChange(Math.max(40, v - 1))}>−</button>
        <div style={{ textAlign: "center" }}>
          <div className="level-num" style={{ color: value ? "var(--text)" : "var(--text3)" }}>{value ?? "—"}</div>
          <div className="level-tier">{value ? tierLabel(value) : "not set"}</div>
        </div>
        <button className="step-btn" onClick={() => onChange(Math.min(99, v + 1))}>+</button>
      </div>
    </div>
  );
}

function Pills({ options, value, onToggle }: { options: string[]; value: string | null | undefined; onToggle: (v: string) => void }) {
  return (
    <div className="pill-row">
      {options.map(o => (
        <button key={o} className={`pill${value === o ? " on" : ""}`}
          onClick={() => onToggle(o === value ? "" : o)}>{o}</button>
      ))}
    </div>
  );
}

function MultiPills({ options, values, onToggle }: { options: string[]; values: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="pill-row">
      {options.map(o => (
        <button key={o} className={`pill${values.includes(o) ? " on" : ""}`}
          onClick={() => onToggle(o)}>{o}</button>
      ))}
    </div>
  );
}

function DataSec({ title, missing, children }: { title: string; missing?: boolean; children: React.ReactNode }) {
  return (
    <div className="data-sec">
      <div className="sh"><span className={missing ? "sh-missing" : ""}>{title}</span></div>
      {children}
    </div>
  );
}

// ── My Call tab ───────────────────────────────────────────────────────────────

function MyCallTab({ player, dof, onDofChange }: {
  player: Player;
  dof: DofDraft;
  onDofChange: (d: Partial<DofDraft>) => void;
}) {
  const pursuit = dof.pursuit_status !== undefined ? dof.pursuit_status : player.pursuit_status;
  const valuation = dof.director_valuation_meur !== undefined ? dof.director_valuation_meur : player.director_valuation_meur;
  const fitNote = dof.fit_note !== undefined ? dof.fit_note : (player.fit_note ?? "");
  const notes = dof.scouting_notes !== undefined ? dof.scouting_notes : (player.scouting_notes ?? "");
  const hint = scarcityHint(player.scarcity_score, player.market_premium);

  return (
    <div className="mycall-tab">
      <div className="dof-section">
        <div className="dof-label">PURSUIT</div>
        <div className="pursuit-row">
          {PURSUIT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`pursuit-btn ${opt.cls}${pursuit === opt.value ? " active" : ""}`}
              onClick={() => onDofChange({ pursuit_status: pursuit === opt.value ? "" : opt.value })}
            >
              {opt.value === "Priority" ? <span>&#9733; {opt.label}</span> : opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dof-section">
        <div className="dof-label">VALUATION</div>
        <div className="valuation-row">
          <div className="val-input-wrap">
            <input
              className="val-input"
              type="number"
              min={0}
              max={999}
              placeholder="—"
              value={valuation ?? ""}
              onChange={e => {
                const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
                onDofChange({ director_valuation_meur: isNaN(v as number) ? null : v });
              }}
            />
            <span className="val-unit">M€</span>
          </div>
          {hint && (
            <span className="val-hint">{hint}</span>
          )}
        </div>
      </div>

      <div className="dof-section">
        <div className="dof-label">FIT NOTE <span className="dof-label-sub">one line — where/how they play in your system</span></div>
        <input
          className="fit-input"
          type="text"
          placeholder="e.g. plays behind our CF as the 10…"
          value={fitNote}
          onChange={e => onDofChange({ fit_note: e.target.value })}
        />
      </div>

      <div className="dof-section dof-section-grow">
        <div className="dof-label">NOTES <span className="dof-label-sub">observations, intel, anything</span></div>
        <textarea
          className="notes-area"
          rows={6}
          placeholder="Your read on this player…"
          value={notes}
          onChange={e => onDofChange({ scouting_notes: e.target.value })}
        />
      </div>
    </div>
  );
}

// ── Data tab ──────────────────────────────────────────────────────────────────

function DataTab({ player, data, onDataChange }: {
  player: Player;
  data: DataDraft;
  onDataChange: (d: Partial<DataDraft>) => void;
}) {
  const existingTraits = player.Character
    ? player.Character.split(",").map(s => s.trim()).filter(Boolean) : [];
  const activeTraits = data.traits ?? existingTraits;

  const toggleTrait = (t: string) => {
    const cur = data.traits ?? existingTraits;
    onDataChange({ traits: cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t] });
  };

  const pos   = data.position           ?? player.position;
  const pos2  = data.secondary_position ?? player.secondary_position;
  const ment  = data.Mentality          ?? player.Mentality;
  const foot  = data.Foot               ?? normFoot(player.Foot ?? null);
  const phys  = data.Physique           ?? player.Physique;
  const model = data.model              ?? player.model;
  const prim  = data.primary            ?? player.primary;
  const sec   = data.secondary          ?? player.secondary;
  const arch  = data.archetype_override ?? player.archetype_override ?? player.archetype;

  return (
    <div className="data-tab">
      <DataSec title={`Position${!player.position ? " · missing" : pos ? ` · ${pos}` : ""}`} missing={!player.position}>
        <div className="pos-pair">
          <div>
            <div className="pos-pair-label">Primary</div>
            <PosGrid value={pos} onChange={p => onDataChange({ position: p })} />
          </div>
          <div>
            <div className="pos-pair-label">Secondary</div>
            <PosGrid value={pos2} onChange={p => onDataChange({ secondary_position: p })} />
          </div>
        </div>
      </DataSec>

      <DataSec title={`Rating${!player.level ? " · missing" : ""}`} missing={!player.level}>
        <div className="level-pair">
          <Stepper label="Level" value={data.level ?? player.level ?? undefined} onChange={v => onDataChange({ level: v })} />
          <Stepper label="Peak"  value={data.peak  ?? player.peak  ?? undefined} onChange={v => onDataChange({ peak: v })} />
        </div>
      </DataSec>

      <DataSec title="Style">
        <div className="pill-pair" style={{ marginBottom: 8 }}>
          <div>
            <div className="pill-sublabel">Mentality</div>
            <Pills options={MENTALITIES} value={ment} onToggle={v => onDataChange({ Mentality: v })} />
          </div>
          <div>
            <div className="pill-sublabel">Foot</div>
            <Pills options={FEET} value={foot} onToggle={v => onDataChange({ Foot: v })} />
          </div>
        </div>
        <div className="pill-sublabel">Physique</div>
        <Pills options={PHYSIQUES} value={phys} onToggle={v => onDataChange({ Physique: v })} />
      </DataSec>

      <DataSec title="Class">
        <div className="pill-pair" style={{ marginBottom: 8 }}>
          <div>
            <div className="pill-sublabel">Primary</div>
            <div className="pill-row">
              {CLASSES.map(c => (
                <button key={c} className={`pill${prim === c ? " on" : ""}`}
                  onClick={() => onDataChange({ primary: c === prim ? "" : c })}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="pill-sublabel">Secondary</div>
            <div className="pill-row">
              {CLASSES.map(c => (
                <button key={c} className={`pill${sec === c ? " on" : ""}`}
                  onClick={() => onDataChange({ secondary: c === sec ? "" : c })}>{c}</button>
              ))}
            </div>
          </div>
        </div>
      </DataSec>

      <DataSec title="Model">
        <input list="models-list" className="model-input"
          placeholder="e.g. Dynamo, Maestro, Wizard…"
          value={model ?? ""}
          onChange={e => onDataChange({ model: e.target.value })} />
        <datalist id="models-list">
          {MODELS.map(m => <option key={m} value={m} />)}
        </datalist>
      </DataSec>

      <DataSec title="Archetype">
        <Pills options={ARCHETYPES} value={arch} onToggle={v => onDataChange({ archetype_override: v })} />
      </DataSec>

      <DataSec title={`Traits${activeTraits.length === 0 ? " · missing" : ` · ${activeTraits.length}`}`} missing={activeTraits.length === 0}>
        <MultiPills options={TRAITS} values={activeTraits} onToggle={toggleTrait} />
      </DataSec>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function Card({ player, dof, data, onDofChange, onDataChange, onSave, onSkip, progress, total, saved }: {
  player: Player; dof: DofDraft; data: DataDraft;
  onDofChange: (d: Partial<DofDraft>) => void;
  onDataChange: (d: Partial<DataDraft>) => void;
  onSave: () => void; onSkip: () => void;
  progress: number; total: number; saved: number;
}) {
  const [tab, setTab] = useState<"mycall" | "data">("mycall");

  const arch = player.archetype_override ?? player.archetype;
  const pos = player.position;

  const hasDofDraft = !!(
    dof.pursuit_status !== undefined ||
    dof.director_valuation_meur !== undefined ||
    dof.fit_note?.trim() ||
    dof.scouting_notes?.trim()
  );

  const existingTraits = player.Character
    ? player.Character.split(",").map(s => s.trim()).filter(Boolean) : [];
  const activeTraits = data.traits ?? existingTraits;
  const traitsChanged = JSON.stringify(activeTraits) !== JSON.stringify(existingTraits);
  const hasDataDraft = !!(
    data.position || data.secondary_position || traitsChanged ||
    data.level || data.peak || data.Mentality || data.Foot || data.Physique ||
    data.model || data.primary || data.secondary || data.archetype_override
  );

  const hasDraft = hasDofDraft || hasDataDraft;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === "Enter" && hasDraft) onSave();
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [hasDraft, onSave, onSkip]);

  return (
    <div className="shell">
      <div className="topbar">
        <span className="topbar-logo">Scout Pad</span>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {saved > 0 && <span style={{ fontSize: "0.68rem", color: "var(--green)", fontWeight: 700 }}>{saved} saved</span>}
          <span className="topbar-count">{progress} / {total}</span>
        </div>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${(progress / Math.max(total, 1)) * 100}%` }} />
      </div>

      {/* ── Player brief header ── */}
      <div className="player-brief">
        <div className="brief-name">{player.name.trim()}</div>
        <div className="brief-row">
          {player.club && <span className="badge badge-club">{player.club.trim()}</span>}
          {!player.club && player.division && <span className="badge badge-club">{player.division}</span>}
          {player.nation && <span className="badge badge-nation">{player.nation}</span>}
          {pos && <span className="badge badge-pos">{pos}</span>}
        </div>
        <div className="brief-metrics">
          {player.scarcity_score != null && (
            <span className="brief-metric">
              <span className="brief-metric-label">Scarcity</span>
              <span className="dot-row">{dots(player.scarcity_score)}</span>
            </span>
          )}
          {player.national_scarcity != null && (
            <span className="brief-metric">
              <span className="brief-metric-label">National</span>
              <span className="dot-row">{dots(player.national_scarcity)}</span>
            </span>
          )}
          {player.market_premium != null && player.market_premium !== 0 && (
            <span className="brief-metric">
              <span className={`premium-badge${player.market_premium > 0 ? " premium-pos" : " premium-neg"}`}>
                {player.market_premium > 0 ? `+${player.market_premium}` : player.market_premium} premium
              </span>
            </span>
          )}
          {arch && <span className="brief-arch">{arch}</span>}
        </div>
      </div>

      <div className="body-split">
        {/* ── Tab bar ── */}
        <div className="tab-bar">
          <button className={`tab-btn${tab === "mycall" ? " active" : ""}`} onClick={() => setTab("mycall")}>
            My Call{hasDofDraft ? <span className="tab-dot" /> : null}
          </button>
          <button className={`tab-btn${tab === "data" ? " active" : ""}`} onClick={() => setTab("data")}>
            Data{hasDataDraft ? <span className="tab-dot" /> : null}
          </button>
        </div>

        {/* ── Tab content ── */}
        <div className="tab-content noscroll">
          {tab === "mycall"
            ? <MyCallTab player={player} dof={dof} onDofChange={onDofChange} />
            : <DataTab player={player} data={data} onDataChange={onDataChange} />
          }
        </div>
      </div>

      <div className="action-bar">
        <button className="btn-skip" onClick={onSkip}>
          Skip <span style={{ opacity: 0.3, fontSize: "0.68rem" }}>esc</span>
        </button>
        <button className={`btn-save${hasDraft ? " hot" : ""}`} onClick={onSave} disabled={!hasDraft}>
          {hasDraft ? "Save & Next" : "No changes"}{" "}
          {hasDraft && <span style={{ opacity: 0.45, fontSize: "0.7rem" }}>↵</span>}
        </button>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function ScoutPad() {
  const [queue,   setQueue]   = useState<Player[]>([]);
  const [index,   setIndex]   = useState(0);
  const [dof,     setDof]     = useState<DofDraft>({});
  const [data,    setData]    = useState<DataDraft>({});
  const [saved,   setSaved]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [done,    setDone]    = useState(false);

  const load = useCallback(async (offset = 0) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/players?limit=60&offset=${offset}`);
      const data: Player[] = await res.json();
      if (!data.length) setDone(true);
      else setQueue(q => offset === 0 ? data : [...q, ...data]);
    } catch { setError("Load failed"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(0); }, [load]);
  const player = queue[index];
  useEffect(() => {
    if (index > queue.length - 12 && !loading) load(queue.length);
  }, [index, queue.length, loading, load]);

  const advance = useCallback(() => { setDof({}); setData({}); setIndex(i => i + 1); }, []);

  const handleSave = useCallback(async () => {
    if (!player || saving) return;

    const existingTraits = player.Character
      ? player.Character.split(",").map(s => s.trim()).filter(Boolean) : [];
    const activeTraits = data.traits ?? existingTraits;
    const traitsChanged = JSON.stringify(activeTraits) !== JSON.stringify(existingTraits);

    const payload: Record<string, unknown> = { id: player.id };

    // DoF fields
    if (dof.pursuit_status !== undefined)
      payload.pursuit_status = dof.pursuit_status === "" ? null : dof.pursuit_status;
    if (dof.director_valuation_meur !== undefined)
      payload.director_valuation_meur = dof.director_valuation_meur;
    if (dof.fit_note !== undefined)
      payload.fit_note = dof.fit_note.trim() || null;
    if (dof.scouting_notes?.trim())
      payload.scouting_notes = dof.scouting_notes.trim();

    // Data fields
    if (data.position)             payload.position            = data.position;
    if (data.secondary_position !== undefined) payload.secondary_position = data.secondary_position || null;
    if (data.level)                payload.level               = data.level;
    if (data.peak)                 payload.peak                = data.peak;
    if (data.Mentality)            payload.Mentality           = data.Mentality;
    if (data.Foot)                 payload.Foot                = data.Foot;
    if (data.Physique)             payload.Physique            = data.Physique;
    if (data.model !== undefined)  payload.model               = data.model || null;
    if (data.primary)              payload.primary             = data.primary;
    if (data.secondary)            payload.secondary           = data.secondary;
    if (data.archetype_override)   payload.archetype_override  = data.archetype_override;
    if (traitsChanged && activeTraits.length) payload.Character = activeTraits.join(", ");

    if (Object.keys(payload).length <= 1) { advance(); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/players", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Save failed"); return; }
      setSaved(s => s + 1);
      advance();
    } catch { setError("Save failed"); }
    finally { setSaving(false); }
  }, [player, dof, data, saving, advance]);

  if (loading && !queue.length) return (
    <div style={{ height:"100dvh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ width:34, height:34, border:"2px solid var(--border2)", borderTopColor:"var(--accent)", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
      <div style={{ fontSize:"0.82rem", color:"var(--text3)" }}>Loading queue…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (done || (!loading && !queue.length) || !player) return (
    <div style={{ height:"100dvh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
      <div style={{ fontSize:"1.3rem", fontWeight:800 }}>Queue empty</div>
      <div style={{ color:"var(--text3)", fontSize:"0.82rem" }}>{saved} saved this session</div>
      <button onClick={() => { setQueue([]); setIndex(0); setDone(false); load(0); }}
        style={{ marginTop:12, padding:"11px 22px", borderRadius:10, background:"var(--accent)", border:"none", color:"white", fontWeight:700, cursor:"pointer" }}>
        Reload
      </button>
    </div>
  );

  return (
    <>
      {error && (
        <div onClick={() => setError(null)}
          style={{ position:"fixed", inset:"14px 14px auto", background:"#3b0a0a", border:"1px solid #ef4444", borderRadius:9, padding:"9px 13px", fontSize:"0.8rem", zIndex:999, cursor:"pointer" }}>
          {error} — tap to dismiss
        </div>
      )}
      <Card
        player={player} dof={dof} data={data}
        onDofChange={d => setDof(p => ({ ...p, ...d }))}
        onDataChange={d => setData(p => ({ ...p, ...d }))}
        onSave={handleSave} onSkip={advance}
        progress={index + 1} total={queue.length} saved={saved}
      />
    </>
  );
}
