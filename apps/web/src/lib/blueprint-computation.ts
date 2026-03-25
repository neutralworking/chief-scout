/**
 * Blueprint Computation — Role × Personality → Scouting Identity
 *
 * A blueprint is the emergent scouting descriptor: what type of player this is.
 * It combines WHERE they play (tactical role) with WHO they are (personality theme).
 *
 * Example: Libero + Captain personality → "Modern CB"
 *          (a CB who builds from back AND commands the defensive line)
 *
 * The role alone gives the tactical function. The personality theme shifts the
 * identity when it creates a meaningfully different scouting descriptor.
 * When it doesn't, the default blueprint = the natural label for that role.
 */

import { PERSONALITY_TYPES, type PersonalityTheme } from "./personality";

// ─── Blueprint vocabulary per position ─────────────────────────────────────
// These are the ONLY valid blueprints. Each is a distinct scouting identity
// that a DOF would use in a board meeting: "We need a Modern CB."

export const BLUEPRINT_VOCABULARY: Record<string, string[]> = {
  GK: ["Shot-Stopper", "Sweeper Keeper", "Commanding Keeper"],
  CD: ["Libero", "Modern CB", "Traditional CB", "Aggressive CB", "Progressor CB"],
  WD: ["Invertido", "Lateral", "Fluidificante", "Attacking Full-Back", "Playmaking Full-Back"],
  DM: ["Anchor", "Deep-Lying Playmaker", "Volante", "Regista", "Box-to-Box Anchor"],
  CM: ["Metronome", "Tuttocampista", "Mezzala", "Deep-Lying Playmaker", "Driver"],
  WM: ["False Winger", "Shuttler", "Wide Provider", "Work-Rate Winger"],
  AM: ["No.10", "Seconda Punta", "Trequartista", "Pressing Playmaker"],
  WF: ["Inside Forward", "Inventor", "Explosive Winger", "Shuttler", "False Winger"],
  CF: ["Poacher", "Prima Punta", "Falso Nove", "Spearhead", "Goal Machine"],
};

// ─── Role × Personality Theme → Blueprint mapping ──────────────────────────
// Each role has a default blueprint and optional theme overrides.
// Themes: general (systematic), catalyst (confrontational), maestro (composed/creative),
//         captain (vocal leader), professor (cerebral/technical)

interface BlueprintRule {
  default: string;
  general?: string;
  catalyst?: string;
  maestro?: string;
  captain?: string;
  professor?: string;
}

const BLUEPRINT_MAP: Record<string, BlueprintRule> = {
  // ── GK ──────────────────────────────────────────────────────────────────
  "Shotstopper": {
    default: "Shot-Stopper",
    captain: "Commanding Keeper",
  },
  "Sweeper Keeper": {
    default: "Sweeper Keeper",
    captain: "Commanding Keeper",
  },

  // ── CD ──────────────────────────────────────────────────────────────────
  // Libero (Ball-Playing CB): builds from back with progressive passing (Beckenbauer)
  "Libero": {
    default: "Libero",
    captain: "Modern CB",       // leader who builds = complete modern defender (Van Dijk)
    catalyst: "Progressor CB",  // aggressive ball-player who drives forward (Konaté)
  },
  // Stopper: front-foot aggression, wins every duel (Vidic)
  "Stopper": {
    default: "Traditional CB",
    catalyst: "Aggressive CB",  // occasion-fueled intensity (Romero)
    captain: "Aggressive CB",   // vocal, commanding aggression (Terry)
  },
  // Sweeper: reads danger, covers space (Baresi)
  "Sweeper": {
    default: "Modern CB",
    maestro: "Libero",    // composed, elegant reading (Bonucci)
    professor: "Libero",  // cerebral game-reader (Hummels)
  },
  // Ball-Carrying CB merged into Libero above (both → "Libero")

  // ── WD ──────────────────────────────────────────────────────────────────
  // Invertido (Inverted Full-Back): tucks inside in possession (Cancelo)
  "Invertido": {
    default: "Invertido",
    maestro: "Playmaking Full-Back",  // creative inverter = playmaker from deep (Cancelo)
    professor: "Playmaking Full-Back",
  },
  // Lateral (Overlapping Full-Back): wide + high, delivers (Cafu)
  "Lateral": {
    default: "Lateral",
    catalyst: "Attacking Full-Back",   // occasion-driven attacker (Dani Alves)
    maestro: "Attacking Full-Back",
  },
  // Fluidificante (Wing-Back): full width both phases, tireless (Hakimi)
  "Fluidificante": {
    default: "Fluidificante",
    catalyst: "Attacking Full-Back",
    general: "Fluidificante",              // systematic shuttle
  },

  // ── DM ──────────────────────────────────────────────────────────────────
  // Regista: deep playmaker, dictates tempo (Pirlo)
  "Regista": {
    default: "Deep-Lying Playmaker",
    maestro: "Regista",       // the archetype — quietly brilliant orchestrator (Pirlo)
    professor: "Regista",     // cerebral tempo-setter (Jorginho)
  },
  // Anchor (Anchor): shields back four, positional (Busquets)
  "Anchor": {
    default: "Anchor",
    catalyst: "Volante",       // aggressive anchor → ball winner (Casemiro)
    professor: "Deep-Lying Playmaker",  // cerebral anchor → DLP tendency
  },
  // Volante (Ball-Winner): aggressive pressing, disrupts (Kanté)
  "Volante": {
    default: "Volante",
    maestro: "Anchor",     // composed disruptor → positional anchor
    professor: "Anchor",
  },
  // Destroyer-Creator: tackles AND creates (Vieira / Yaya Touré)
  "Destroyer-Creator": {
    default: "Box-to-Box Anchor",
    maestro: "Deep-Lying Playmaker",  // creative side dominates
    captain: "Box-to-Box Anchor",     // leads from DM
  },

  // ── CM ──────────────────────────────────────────────────────────────────
  // Mezzala: half-space runner, arrives in box (Barella)
  "Mezzala": {
    default: "Mezzala",
    general: "Driver",         // systematic half-space runner (Valverde)
    catalyst: "Driver",        // aggressive runner
  },
  // Tuttocampista (Box-to-Box): covers both penalty areas (Lampard)
  "Tuttocampista": {
    default: "Tuttocampista",
    maestro: "Driver",         // composed B2B → drives with purpose
    professor: "Metronome",    // cerebral B2B → metronomic presence
  },
  // Metodista (Deep Playmaker): orchestrates possession from CM (Xavi)
  "Metodista": {
    default: "Deep-Lying Playmaker",
    maestro: "Metronome",      // quietly brilliant orchestrator (Xavi)
    professor: "Metronome",    // cerebral tempo (Kroos)
    captain: "Metronome",      // commanding orchestrator (Modric)
  },

  // ── WM ──────────────────────────────────────────────────────────────────
  // False Winger (Wide Playmaker): drifts inside, creates from half-spaces (Silva)
  "False Winger": {
    default: "False Winger",
  },
  // Wide Provider: touchline hugger, precision delivery (Beckham)
  "Wide Provider": {
    default: "Wide Provider",
    catalyst: "Shuttler",   // occasion-driven provider → more direct
  },
  // Shuttler (Direct Winger): beats his man, stretches defence (Giggs)
  "Shuttler": {
    default: "Shuttler",
    general: "Work-Rate Winger",  // systematic direct winger → both phases
    captain: "Work-Rate Winger",
  },
  // Winger (Traditional Winger): width, delivery, direct running
  "Winger": {
    default: "Shuttler",
    maestro: "Wide Provider",     // composed traditional winger → delivery focus
    professor: "Wide Provider",
    general: "Work-Rate Winger",
  },

  // ── AM ──────────────────────────────────────────────────────────────────
  // Trequartista: free-roaming artist (Zidane)
  "Trequartista": {
    default: "Trequartista",
    general: "No.10",           // systematic creator → classic 10
    captain: "No.10",           // commanding creator → classic 10
  },
  // Enganche (Advanced Playmaker): links midfield to attack (De Bruyne)
  "Enganche": {
    default: "No.10",
    catalyst: "Pressing Playmaker",  // aggressive creator → presses too
  },
  // Seconda Punta (Shadow Striker): late runs between the lines (Müller)
  "Seconda Punta": {
    default: "Seconda Punta",
    general: "Seconda Punta",
    catalyst: "Pressing Playmaker",  // aggressive between-lines runner
  },

  // ── WF ──────────────────────────────────────────────────────────────────
  // Inside Forward: cuts inside, shoots (Salah)
  "Inside Forward": {
    default: "Inside Forward",
    maestro: "Inventor",    // composed inside forward → creative cutter (Bernardo)
    professor: "Inventor",
  },
  // Inventor (Inverted Winger): creates from inside (Bernardo Silva)
  "Inventor": {
    default: "Inventor",
    catalyst: "Inside Forward",    // aggressive inverted winger → goal threat
    general: "Inside Forward",
  },
  // Extremo (Wide Forward): stretches defence, devastating pace (Mbappé)
  "Extremo": {
    default: "Explosive Winger",
    maestro: "Inside Forward",     // composed wide forward → cuts in with purpose
    professor: "Inside Forward",
    general: "Shuttler",           // systematic pace merchant → more structured
  },

  // ── CF ──────────────────────────────────────────────────────────────────
  // Prima Punta (Target Man): holds up, wins aerial duels (Giroud)
  "Prima Punta": {
    default: "Prima Punta",
    maestro: "Poacher",    // composed target → links play too
    professor: "Poacher",
  },
  // Poacher: clinical inside the box (Inzaghi)
  "Poacher": {
    default: "Poacher",
    general: "Goal Machine",       // systematic poacher → relentless finisher
    captain: "Goal Machine",       // competitive poacher → demands goals
  },
  // Falso Nove (False 9): drops deep, links play (Messi)
  "Falso Nove": {
    default: "Falso Nove",
  },
  // Poacher (Complete Forward): does everything (Benzema) — merged into Poacher key above
  // Spearhead (Pressing Forward): defends from the front (Firmino)
  "Spearhead": {
    default: "Spearhead",
    maestro: "Falso Nove",         // composed presser → drops and links (Firmino evolution)
  },
  // Raumdeuter: space interpreter (Müller)
  "Raumdeuter": {
    default: "Seconda Punta",
    captain: "Spearhead",          // vocal space-reader → organises press
  },
};

// ─── Computation ───────────────────────────────────────────────────────────

/**
 * Get personality theme from a personality code (e.g., "ANLC" → "general").
 * Returns null if code is unknown.
 */
export function getPersonalityTheme(personalityCode: string | null | undefined): PersonalityTheme | null {
  if (!personalityCode) return null;
  return PERSONALITY_TYPES[personalityCode]?.theme ?? null;
}

/**
 * Compute the blueprint from a player's best role and personality type.
 *
 * @param bestRole - The tactical role name (e.g., "Libero", "Regista")
 * @param personalityType - The 4-letter personality code (e.g., "ANLC", "IXSP")
 * @param position - Optional fallback position for vocabulary validation
 * @returns The computed blueprint string, or null if role is unknown
 */
export function computeBlueprint(
  bestRole: string | null | undefined,
  personalityType: string | null | undefined,
  _position?: string | null,
): string | null {
  if (!bestRole) return null;

  const rule = BLUEPRINT_MAP[bestRole];
  if (!rule) return null;

  const theme = getPersonalityTheme(personalityType);
  if (theme && rule[theme]) {
    return rule[theme]!;
  }

  return rule.default;
}

/**
 * Get all valid blueprints for a position.
 */
export function getBlueprintsForPosition(position: string): string[] {
  return BLUEPRINT_VOCABULARY[position] ?? [];
}

/**
 * Check if a blueprint is valid for a given position.
 */
export function isValidBlueprint(blueprint: string, position: string): boolean {
  return (BLUEPRINT_VOCABULARY[position] ?? []).includes(blueprint);
}
