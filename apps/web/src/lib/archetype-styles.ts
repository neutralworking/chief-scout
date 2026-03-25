/**
 * Earned archetype styling config
 *
 * Maps the 29 earned archetypes to category-based colors.
 * Used by PlayerCard, player detail, /players list, free-agents, etc.
 *
 * Color philosophy (dark theme):
 *  - Elite attacking: warm red/orange (#e8564a, #f59e0b)
 *  - Creative: purple/violet (#a78bfa, #c084fc)
 *  - Physical/Combative: earth/amber (#d97706, #b45309)
 *  - Direct: orange (#f97316)
 *  - Defensive: steel/slate (#94a3b8, #64748b)
 *  - Role players: teal (#2dd4bf, #14b8a6)
 *  - Mid-tier: muted blue (#60a5fa, #3b82f6)
 *  - Goalkeepers: green (#4ade80, #22c55e)
 */

export type ArchetypeCategory =
  | "elite_attacking"
  | "creative"
  | "physical"
  | "direct"
  | "defensive"
  | "role_player"
  | "mid_tier"
  | "goalkeeper"
  | "legend_culture";

interface ArchetypeStyle {
  /** Category grouping */
  category: ArchetypeCategory;
  /** Hex color for text/badge */
  color: string;
  /** Tailwind bg class (with opacity) for badge background */
  bgClass: string;
  /** Tailwind text class for badge text */
  textClass: string;
}

const ARCHETYPE_STYLES: Record<string, ArchetypeStyle> = {
  // ── Elite attacking ──────────────────────────────────────
  Marksman:  { category: "elite_attacking", color: "#ef4444", bgClass: "bg-red-500/15",    textClass: "text-red-400" },
  Conjurer:  { category: "elite_attacking", color: "#f59e0b", bgClass: "bg-amber-500/15",  textClass: "text-amber-400" },
  Virtuoso:  { category: "elite_attacking", color: "#f97316", bgClass: "bg-orange-500/15", textClass: "text-orange-400" },
  Hunter:    { category: "elite_attacking", color: "#ef4444", bgClass: "bg-red-500/15",    textClass: "text-red-400" },

  // ── Creative ─────────────────────────────────────────────
  Architect: { category: "creative", color: "#a78bfa", bgClass: "bg-violet-500/15",  textClass: "text-violet-400" },
  Fulcrum:   { category: "creative", color: "#c084fc", bgClass: "bg-purple-500/15",  textClass: "text-purple-400" },
  Artisan:   { category: "creative", color: "#a78bfa", bgClass: "bg-violet-500/15",  textClass: "text-violet-400" },
  Pulse:     { category: "creative", color: "#818cf8", bgClass: "bg-indigo-500/15",  textClass: "text-indigo-400" },

  // ── Physical / Combative ─────────────────────────────────
  Goliath:   { category: "physical", color: "#d97706", bgClass: "bg-amber-600/15",   textClass: "text-amber-500" },
  Warrior:   { category: "physical", color: "#b45309", bgClass: "bg-amber-700/15",   textClass: "text-amber-600" },
  Sentinel:  { category: "physical", color: "#d97706", bgClass: "bg-amber-600/15",   textClass: "text-amber-500" },
  Terrier:   { category: "physical", color: "#ca8a04", bgClass: "bg-yellow-600/15",  textClass: "text-yellow-500" },

  // ── Direct ───────────────────────────────────────────────
  Outlet:    { category: "direct", color: "#fb923c", bgClass: "bg-orange-400/15", textClass: "text-orange-300" },
  Fox:       { category: "direct", color: "#f97316", bgClass: "bg-orange-500/15", textClass: "text-orange-400" },

  // ── Defensive ────────────────────────────────────────────
  Fortress:  { category: "defensive", color: "#94a3b8", bgClass: "bg-slate-400/15",  textClass: "text-slate-300" },
  Rock:      { category: "defensive", color: "#64748b", bgClass: "bg-slate-500/15",  textClass: "text-slate-400" },
  Lockdown:  { category: "defensive", color: "#64748b", bgClass: "bg-slate-500/15",  textClass: "text-slate-400" },
  Reader:    { category: "defensive", color: "#94a3b8", bgClass: "bg-slate-400/15",  textClass: "text-slate-300" },

  // ── Role players ─────────────────────────────────────────
  Marshal:   { category: "role_player", color: "#2dd4bf", bgClass: "bg-teal-500/15",  textClass: "text-teal-400" },
  Utility:   { category: "role_player", color: "#14b8a6", bgClass: "bg-teal-600/15",  textClass: "text-teal-500" },
  Support:   { category: "role_player", color: "#14b8a6", bgClass: "bg-teal-600/15",  textClass: "text-teal-500" },
  Grafter:   { category: "role_player", color: "#2dd4bf", bgClass: "bg-teal-500/15",  textClass: "text-teal-400" },

  // ── Mid-tier ─────────────────────────────────────────────
  Connector: { category: "mid_tier", color: "#60a5fa", bgClass: "bg-blue-500/15",  textClass: "text-blue-400" },
  Raider:    { category: "mid_tier", color: "#3b82f6", bgClass: "bg-blue-600/15",  textClass: "text-blue-500" },
  "Battering Ram": { category: "mid_tier", color: "#60a5fa", bgClass: "bg-blue-500/15", textClass: "text-blue-400" },
  Drifter:   { category: "mid_tier", color: "#93c5fd", bgClass: "bg-blue-400/15",  textClass: "text-blue-300" },
  Sentry:    { category: "mid_tier", color: "#3b82f6", bgClass: "bg-blue-600/15",  textClass: "text-blue-500" },
  Safety:    { category: "mid_tier", color: "#60a5fa", bgClass: "bg-blue-500/15",  textClass: "text-blue-400" },

  // ── Goalkeepers ──────────────────────────────────────────
  Wall:      { category: "goalkeeper", color: "#4ade80", bgClass: "bg-green-500/15",  textClass: "text-green-400" },
  Sweeper:   { category: "goalkeeper", color: "#22c55e", bgClass: "bg-green-600/15",  textClass: "text-green-500" },

  // ── Football-culture (legend nicknames) ─────────────────
  "Fenômeno":  { category: "legend_culture", color: "#f43f5e", bgClass: "bg-rose-500/15",    textClass: "text-rose-400" },
  Kaiser:      { category: "legend_culture", color: "#a1a1aa", bgClass: "bg-zinc-400/15",    textClass: "text-zinc-300" },
  Pendolino:   { category: "legend_culture", color: "#34d399", bgClass: "bg-emerald-400/15", textClass: "text-emerald-300" },
  Tractor:     { category: "legend_culture", color: "#34d399", bgClass: "bg-emerald-400/15", textClass: "text-emerald-300" },
  Arrow:       { category: "legend_culture", color: "#fbbf24", bgClass: "bg-yellow-400/15",  textClass: "text-yellow-300" },
  Bomber:      { category: "legend_culture", color: "#f43f5e", bgClass: "bg-rose-500/15",    textClass: "text-rose-400" },
  Pitbull:     { category: "legend_culture", color: "#b45309", bgClass: "bg-amber-700/15",   textClass: "text-amber-600" },
  Metronome:   { category: "legend_culture", color: "#818cf8", bgClass: "bg-indigo-500/15",  textClass: "text-indigo-400" },
};

const DEFAULT_STYLE: ArchetypeStyle = {
  category: "mid_tier",
  color: "#9ca3af",
  bgClass: "bg-zinc-500/15",
  textClass: "text-zinc-400",
};

/**
 * Get the styling for an earned archetype name.
 * Returns default neutral styling for unknown archetypes.
 */
export function getArchetypeStyle(archetype: string | null | undefined): ArchetypeStyle {
  if (!archetype) return DEFAULT_STYLE;
  return ARCHETYPE_STYLES[archetype] ?? DEFAULT_STYLE;
}

/**
 * Get the hex color for an archetype (for inline style={{ color }}).
 */
export function getArchetypeColor(archetype: string | null | undefined): string {
  return getArchetypeStyle(archetype).color;
}

/**
 * Get Tailwind badge classes for an archetype (bg + text).
 */
export function getArchetypeBadgeClasses(archetype: string | null | undefined): string {
  const s = getArchetypeStyle(archetype);
  return `${s.bgClass} ${s.textClass}`;
}

/** All known archetype names */
export const ARCHETYPE_NAMES = Object.keys(ARCHETYPE_STYLES);
