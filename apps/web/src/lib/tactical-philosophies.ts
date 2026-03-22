/**
 * Tactical philosophy scoring and utilities.
 *
 * Port of valuation_core/fit/system_fit.py — scores a player's fit
 * against a philosophy's archetype requirements, personality preferences,
 * and style tag preferences.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface TacticalPhilosophy {
  id: number;
  name: string;
  slug: string;
  tagline: string | null;
  origin_story: string | null;
  key_principles: string[] | null;
  defining_managers: string[] | null;
  era: string | null;
  archetype_requirements: Record<string, number> | null;
  personality_preferences: Record<string, number> | null;
  preferred_tags: string[] | null;
  concern_tags: string[] | null;
  key_attributes: string[] | null;
  possession_orientation: number | null;
  pressing_intensity: number | null;
  directness: number | null;
  defensive_depth: number | null;
  width_emphasis: number | null;
  fluidity: number | null;
}

export interface PhilosophyFormation {
  philosophy_id: number;
  formation_id: number;
  affinity: "primary" | "secondary" | "compatible";
  notes: string | null;
}

export interface PhilosophyRole {
  philosophy_id: number;
  role_id: number;
  importance: "essential" | "preferred" | "compatible";
  rationale: string | null;
}

// ── Radar dimensions ─────────────────────────────────────────────────────────

export const PHILOSOPHY_DIMENSIONS = [
  { key: "possession_orientation", label: "Possession", short: "POS" },
  { key: "pressing_intensity", label: "Pressing", short: "PRS" },
  { key: "directness", label: "Directness", short: "DIR" },
  { key: "defensive_depth", label: "Def. Depth", short: "DEF" },
  { key: "width_emphasis", label: "Width", short: "WID" },
  { key: "fluidity", label: "Fluidity", short: "FLU" },
] as const;

export function getRadarValues(philosophy: TacticalPhilosophy): number[] {
  return PHILOSOPHY_DIMENSIONS.map((d) => {
    const val = philosophy[d.key as keyof TacticalPhilosophy] as number | null;
    return (val ?? 5) * 10; // scale 1-10 → 0-100 for RadarChart
  });
}

export function getRadarLabels(): string[] {
  return PHILOSOPHY_DIMENSIONS.map((d) => d.short);
}

// ── Philosophy colors ────────────────────────────────────────────────────────

const PHILOSOPHY_COLORS: Record<string, string> = {
  garra_charrua: "#6366f1",    // indigo
  catenaccio: "#64748b",       // slate
  joga_bonito: "#f59e0b",      // amber
  total_football: "#f97316",   // orange
  la_masia: "#a855f7",         // purple
  gegenpressing: "#ef4444",    // red
  bielsismo: "#22c55e",        // green
  cholismo: "#14b8a6",         // teal
  pomo: "#78716c",             // stone
  fergie_time: "#dc2626",      // red-dark
};

export function getPhilosophyColor(slug: string): string {
  return PHILOSOPHY_COLORS[slug] ?? "var(--color-accent-tactical)";
}

// ── Player-philosophy fit scoring ────────────────────────────────────────────

interface ScoringPlayer {
  archetype: string | null;
  personality_type: string | null;
  level: number | null;
}

/**
 * Score a player's fit against a philosophy (0-100).
 * Simplified port of valuation_core/fit/system_fit.py
 */
export function scorePlayerForPhilosophy(
  player: ScoringPlayer,
  philosophy: TacticalPhilosophy,
): number {
  const archetypeFit = computeArchetypeFit(player, philosophy);
  const personalityFit = computePersonalityFit(player, philosophy);
  const levelBonus = (player.level ?? 0) / 20; // 0-1 from level 0-20

  // Weighted: archetype 40%, personality 30%, level 30%
  const raw = archetypeFit * 0.4 + personalityFit * 0.3 + levelBonus * 0.3;
  return Math.round(raw * 100);
}

function computeArchetypeFit(
  player: ScoringPlayer,
  philosophy: TacticalPhilosophy,
): number {
  const requirements = philosophy.archetype_requirements;
  if (!requirements || !player.archetype) return 0.5;

  // Check if the player's primary archetype is one of the required ones
  const archetypes = Object.keys(requirements);
  if (archetypes.includes(player.archetype)) {
    // Higher threshold = more important → better fit
    const threshold = requirements[player.archetype];
    return Math.min(1.0, 0.7 + (threshold / 100) * 0.3);
  }

  return 0.3; // archetype not required by this philosophy
}

function computePersonalityFit(
  player: ScoringPlayer,
  philosophy: TacticalPhilosophy,
): number {
  const prefs = philosophy.personality_preferences;
  if (!prefs || !player.personality_type) return 0.5;

  const code = player.personality_type;
  // Map pole letters to positions in the 4-letter code
  const polePositions: Record<string, number> = {
    A: 0, I: 0,
    X: 1, N: 1,
    S: 2, L: 2,
    C: 3, P: 3,
  };

  let totalWeight = 0;
  let alignment = 0;

  for (const [pole, importance] of Object.entries(prefs)) {
    const pos = polePositions[pole];
    if (pos !== undefined && pos < code.length) {
      totalWeight += importance;
      if (code[pos] === pole) {
        alignment += importance;
      }
    }
  }

  return totalWeight > 0 ? alignment / totalWeight : 0.5;
}

// ── Affinity badges ──────────────────────────────────────────────────────────

export function affinityStyle(affinity: string): string {
  switch (affinity) {
    case "primary":
      return "bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)] border-[var(--color-accent-tactical)]/30";
    case "secondary":
      return "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]";
    case "compatible":
      return "bg-transparent text-[var(--text-muted)] border-[var(--border-subtle)]";
    default:
      return "bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]";
  }
}

export function importanceStyle(importance: string): string {
  switch (importance) {
    case "essential":
      return "bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)]";
    case "preferred":
      return "bg-[var(--bg-elevated)] text-[var(--text-secondary)]";
    case "compatible":
      return "bg-transparent text-[var(--text-muted)]";
    default:
      return "text-[var(--text-muted)]";
  }
}
